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

      const pendingAgg = await db.rewardEvent.aggregate({
        where: { userId: user.id, weekKey, status: "PENDING" },
        _sum: { amount: true },
      });

      const paidAgg = await db.rewardEvent.aggregate({
        where: { userId: user.id, weekKey, status: "PAID" },
        _sum: { amount: true },
      });

      return {
        weekKey,
        total: (agg._sum.amount ?? 0n).toString(),
        pending: (pendingAgg._sum.amount ?? 0n).toString(),
        paid: (paidAgg._sum.amount ?? 0n).toString(),
      };
    })
  );

  // Calculate all-time totals
  const allTimeAgg = await db.rewardEvent.aggregate({
    where: { userId: user.id },
    _sum: { amount: true },
  });

  const allTimePaidAgg = await db.rewardEvent.aggregate({
    where: { userId: user.id, status: "PAID" },
    _sum: { amount: true },
  });

  return NextResponse.json({
    ok: true,
    weeks: weekSummaries,
    allTime: {
      total: (allTimeAgg._sum.amount ?? 0n).toString(),
      paid: (allTimePaidAgg._sum.amount ?? 0n).toString(),
    },
  });
}
