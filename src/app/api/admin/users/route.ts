/**
 * Admin API: List all users with stats
 * GET /api/admin/users?page=1&pageSize=20&search=...
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const adminWallets = new Set(
    (process.env.ADMIN_WALLETS || "")
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean)
  );
  const isAdminByRole = access.user.role === "ADMIN";
  const isAdminByWallet =
    !!(access.user.walletAddress && adminWallets.has(access.user.walletAddress));

  if (!isAdminByRole && !isAdminByWallet) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
  const search = searchParams.get("search")?.trim() || "";

  const skip = (page - 1) * pageSize;

  // Build where clause
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { walletAddress: { contains: search, mode: "insensitive" as const } },
          { id: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  // Get total count
  const total = await db.user.count({ where });

  // Get users with aggregated stats
  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
    select: {
      id: true,
      email: true,
      walletAddress: true,
      role: true,
      createdAt: true,
    },
  });

  // Get stats for each user in parallel
  const usersWithStats = await Promise.all(
    users.map(async (u) => {
      // Get all-time stats if available
      const allTimeStat = await db.allTimeUserStat.findUnique({
        where: { userId: u.id },
        select: {
          scoreReceived: true,
        },
      });

      // Get total votes cast
      const totalVotesCast = await db.weeklyVoterStat.aggregate({
        where: { userId: u.id },
        _sum: { votesCast: true },
      });

      // Get total comments made
      const totalCommentsMade = await db.comment.count({
        where: { authorId: u.id },
      });

      // Get total XESS earned (from RewardEvent)
      const totalXessEarned = await db.rewardEvent.aggregate({
        where: { userId: u.id, status: "PAID" },
        _sum: { amount: true },
      });

      const xessAmount = totalXessEarned._sum.amount || 0n;
      const xessFormatted =
        xessAmount > 0n
          ? (Number(xessAmount) / 1_000_000).toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })
          : "0";

      return {
        id: u.id,
        email: u.email,
        walletAddress: u.walletAddress,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        stats: {
          totalLikesReceived: allTimeStat?.scoreReceived || 0,
          totalVotesCast: totalVotesCast._sum.votesCast || 0,
          totalCommentsMade,
          totalXessEarned: xessFormatted,
        },
      };
    })
  );

  return NextResponse.json({
    ok: true,
    users: usersWithStats,
    total,
    page,
    pageSize,
  });
}
