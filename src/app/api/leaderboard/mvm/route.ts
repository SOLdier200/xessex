import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { truncWallet } from "@/lib/scoring";

export const runtime = "nodejs";

/**
 * GET /api/leaderboard/mvm?limit=50
 *
 * Public leaderboard for MVM ladder.
 * - Ranks users by mvmPoints desc, then createdAt asc (stable)
 * - Returns only safe fields
 * - If requester is authed, also returns their rank + points
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limitRaw = searchParams.get("limit");
  const limitNum = limitRaw ? Number(limitRaw) : 50;
  const limit = Number.isFinite(limitNum) ? Math.max(1, Math.min(200, Math.floor(limitNum))) : 50;

  const access = await getAccessContext();
  const meId = access.user?.id ?? null;

  // Top list
  const top = await db.user.findMany({
    where: { mvmPoints: { gt: 0 } },
    orderBy: [{ mvmPoints: "desc" }, { createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      walletAddress: true,
      solWallet: true,
      email: true,
      mvmPoints: true,
      createdAt: true,
      role: true,
    },
  });

  const leaderboard = top.map((u, idx) => {
    const primaryWallet = u.walletAddress || u.solWallet || null;

    return {
      rank: idx + 1,
      userId: u.id,
      display: truncWallet(primaryWallet, u.email),
      points: u.mvmPoints,
      role: u.role,
      joinedAt: u.createdAt.toISOString(),
    };
  });

  // Optional: my rank (only if authed)
  let me: null | { rank: number; points: number; display: string } = null;

  if (meId) {
    const mine = await db.user.findUnique({
      where: { id: meId },
      select: { id: true, mvmPoints: true, walletAddress: true, solWallet: true, email: true, createdAt: true },
    });

    if (mine) {
      // Rank = 1 + number of users with strictly more points,
      // plus tie-breaker: if same points, users created earlier are "ahead".
      const ahead = await db.user.count({
        where: {
          OR: [
            { mvmPoints: { gt: mine.mvmPoints } },
            {
              AND: [
                { mvmPoints: mine.mvmPoints },
                { createdAt: { lt: mine.createdAt } },
              ],
            },
          ],
        },
      });

      const primaryWallet = mine.walletAddress || mine.solWallet || null;

      me = {
        rank: ahead + 1,
        points: mine.mvmPoints,
        display: truncWallet(primaryWallet, mine.email),
      };
    }
  }

  return NextResponse.json({
    ok: true,
    leaderboard,
    me,
    meta: { limit },
  });
}
