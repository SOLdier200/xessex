/**
 * Debug endpoint to see what rewards exist in the DB
 */

import { NextResponse } from "next/server";
import { requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Get reward counts by weekKey (UNCLAIMED)
  const byWeekKeyUnclaimed = await db.rewardEvent.groupBy({
    by: ["weekKey"],
    where: { status: "PAID", claimedAt: null },
    _count: { id: true },
    _sum: { amount: true },
  });

  // Get reward counts by weekKey (ALL - including claimed)
  const byWeekKeyAll = await db.rewardEvent.groupBy({
    by: ["weekKey"],
    where: { status: "PAID" },
    _count: { id: true },
    _sum: { amount: true },
  });

  // Get reward counts by refType (ALL)
  const byRefType = await db.rewardEvent.groupBy({
    by: ["refType"],
    where: { status: "PAID" },
    _count: { id: true },
    _sum: { amount: true },
  });

  // Check for REAL rewards (non-test weekKeys)
  const realWeekKeys = await db.rewardEvent.groupBy({
    by: ["weekKey"],
    where: {
      status: "PAID",
      weekKey: { not: { startsWith: "test" } },
    },
    _count: { id: true },
    _sum: { amount: true },
  });

  // Get sample rewards for one user to see duplicates
  const sampleUser = await db.rewardEvent.findFirst({
    where: { status: "PAID", claimedAt: null },
    select: { userId: true },
  });

  let sampleUserRewards: any[] = [];
  if (sampleUser) {
    sampleUserRewards = await db.rewardEvent.findMany({
      where: { userId: sampleUser.userId, status: "PAID", claimedAt: null },
      select: {
        id: true,
        weekKey: true,
        type: true,
        amount: true,
        refType: true,
        refId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  // Format for display
  const formatAmount = (amount: bigint | null) => {
    if (!amount) return "0";
    return `${(Number(amount) / 1_000_000).toLocaleString()} XESS`;
  };

  return NextResponse.json({
    ok: true,
    realWeekKeys: realWeekKeys.map(w => ({
      weekKey: w.weekKey,
      count: w._count.id,
      totalXess: formatAmount(w._sum.amount),
      rawAmount: w._sum.amount?.toString(),
    })),
    byWeekKeyUnclaimed: byWeekKeyUnclaimed.map(w => ({
      weekKey: w.weekKey,
      count: w._count.id,
      totalXess: formatAmount(w._sum.amount),
      rawAmount: w._sum.amount?.toString(),
    })),
    byWeekKeyAll: byWeekKeyAll.map(w => ({
      weekKey: w.weekKey,
      count: w._count.id,
      totalXess: formatAmount(w._sum.amount),
      rawAmount: w._sum.amount?.toString(),
    })),
    byRefType: byRefType.map(r => ({
      refType: r.refType,
      count: r._count.id,
      totalXess: formatAmount(r._sum.amount),
    })),
    sampleUserId: sampleUser?.userId,
    sampleUserRewards: sampleUserRewards.map(r => ({
      ...r,
      amount: r.amount.toString(),
      xess: formatAmount(r.amount),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
