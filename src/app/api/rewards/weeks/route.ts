import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/rewards/weeks
 * Returns a list of weeks where the user has rewards, sorted most recent first.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Get distinct week keys where user has rewards
  const weeks = await db.rewardEvent.findMany({
    where: { userId: user.id },
    select: { weekKey: true },
    distinct: ["weekKey"],
    orderBy: { weekKey: "desc" },
  });

  // For each week, calculate totals
  const weekSummaries = await Promise.all(
    weeks.map(async ({ weekKey }) => {
      const agg = await db.rewardEvent.aggregate({
        where: { userId: user.id, weekKey },
        _sum: { amount: true },
      });

      // Pending = status PAID but NOT YET claimed (claimedAt is null)
      const pendingAgg = await db.rewardEvent.aggregate({
        where: { userId: user.id, weekKey, status: "PAID", claimedAt: null },
        _sum: { amount: true },
      });

      // Actually claimed = claimedAt is set
      const claimedAgg = await db.rewardEvent.aggregate({
        where: { userId: user.id, weekKey, claimedAt: { not: null } },
        _sum: { amount: true },
      });

      return {
        weekKey,
        total: (agg._sum.amount ?? 0n).toString(),
        pending: (pendingAgg._sum.amount ?? 0n).toString(),
        paid: (claimedAgg._sum.amount ?? 0n).toString(), // Actually claimed
      };
    })
  );

  // Calculate all-time totals
  const allTimeAgg = await db.rewardEvent.aggregate({
    where: { userId: user.id },
    _sum: { amount: true },
  });

  // All-time PAID = actually claimed (claimedAt is set)
  const allTimeClaimedAgg = await db.rewardEvent.aggregate({
    where: { userId: user.id, claimedAt: { not: null } },
    _sum: { amount: true },
  });

  // All-time PENDING = status PAID but not yet claimed
  const allTimePendingAgg = await db.rewardEvent.aggregate({
    where: { userId: user.id, status: "PAID", claimedAt: null },
    _sum: { amount: true },
  });

  return NextResponse.json({
    ok: true,
    weeks: weekSummaries,
    allTime: {
      total: (allTimeAgg._sum.amount ?? 0n).toString(),
      paid: (allTimeClaimedAgg._sum.amount ?? 0n).toString(), // Actually claimed
      pending: (allTimePendingAgg._sum.amount ?? 0n).toString(), // Ready to claim
    },
  });
}
