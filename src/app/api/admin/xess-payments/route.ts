import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

/**
 * GET /api/admin/xess-payments
 *
 * Returns XESS token payment data:
 *   - No params: list of all payout periods (weekKeys from RewardBatch)
 *   - ?weekKey=xxx: all users for that period with totals + claim status
 *   - ?weekKey=xxx&userId=xxx: detailed breakdown for one user in that period
 */
export async function GET(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.user)
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (!access.isAdminOrMod)
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const url = req.nextUrl;
  const weekKey = url.searchParams.get("weekKey");
  const userId = url.searchParams.get("userId");

  try {
    // Detail view: single user's rewards for a period
    if (weekKey && userId) {
      const events = await db.rewardEvent.findMany({
        where: { weekKey, userId },
        orderBy: { amount: "desc" },
        select: {
          id: true,
          type: true,
          amount: true,
          status: true,
          refType: true,
          refId: true,
          claimedAt: true,
          createdAt: true,
        },
      });

      const serialized = events.map((e) => ({
        id: e.id,
        type: e.type,
        amount: e.amount.toString(),
        status: e.claimedAt ? "CLAIMED" : e.status,
        refType: e.refType,
        refId: e.refId,
        claimedAt: e.claimedAt?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
      }));

      const total = events.reduce((s, e) => s + e.amount, 0n);
      const claimed = events.some((e) => e.claimedAt !== null);

      return NextResponse.json({
        ok: true,
        weekKey,
        userId,
        events: serialized,
        total: total.toString(),
        claimed,
      });
    }

    // Users view: all users for a given period
    if (weekKey) {
      const rows: Array<{
        userId: string;
        total: bigint;
        count: bigint;
        claimed_count: bigint;
      }> = await db.$queryRaw`
        SELECT
          "userId",
          SUM("amount")::bigint as total,
          COUNT(*)::bigint as count,
          COUNT("claimedAt")::bigint as claimed_count
        FROM "RewardEvent"
        WHERE "weekKey" = ${weekKey}
          AND "status" = 'PAID'
        GROUP BY "userId"
        ORDER BY total DESC
      `;

      // Fetch user info for all userIds
      const userIds = rows.map((r) => r.userId);
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, email: true, walletAddress: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      const serialized = rows.map((r) => {
        const user = userMap.get(r.userId);
        return {
          userId: r.userId,
          username: user?.username ?? null,
          email: user?.email ?? null,
          walletAddress: user?.walletAddress ?? null,
          total: r.total.toString(),
          eventCount: Number(r.count),
          claimed: Number(r.claimed_count) > 0,
        };
      });

      const grandTotal = rows.reduce((s, r) => s + r.total, 0n);
      const claimedCount = serialized.filter((r) => r.claimed).length;

      return NextResponse.json({
        ok: true,
        weekKey,
        users: serialized,
        totalUsers: serialized.length,
        grandTotal: grandTotal.toString(),
        claimedCount,
      });
    }

    // Periods list: all payout batches
    const batches = await db.rewardBatch.findMany({
      where: { status: "DONE" },
      orderBy: { createdAt: "desc" },
      select: {
        weekKey: true,
        totalAmount: true,
        totalUsers: true,
        finishedAt: true,
        createdAt: true,
      },
    });

    // Check claim status per period
    const weekKeys = batches.map((b) => b.weekKey);
    const claimCounts: Array<{ weekKey: string; claimed: bigint; total: bigint }> =
      weekKeys.length > 0
        ? await db.$queryRaw`
            SELECT
              "weekKey",
              COUNT(DISTINCT CASE WHEN "claimedAt" IS NOT NULL THEN "userId" END)::bigint as claimed,
              COUNT(DISTINCT "userId")::bigint as total
            FROM "RewardEvent"
            WHERE "weekKey" = ANY(${weekKeys})
              AND "status" = 'PAID'
            GROUP BY "weekKey"
          `
        : [];

    const claimMap = new Map(
      claimCounts.map((c) => [c.weekKey, { claimed: Number(c.claimed), total: Number(c.total) }])
    );

    const periods = batches.map((b) => {
      const claims = claimMap.get(b.weekKey);
      return {
        weekKey: b.weekKey,
        totalAmount: b.totalAmount?.toString() ?? "0",
        totalUsers: b.totalUsers ?? 0,
        finishedAt: b.finishedAt?.toISOString() ?? null,
        createdAt: b.createdAt.toISOString(),
        claimedUsers: claims?.claimed ?? 0,
        totalUsersWithRewards: claims?.total ?? 0,
      };
    });

    return NextResponse.json({ ok: true, periods });
  } catch (error) {
    console.error("[XESS_PAYMENTS] GET error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
