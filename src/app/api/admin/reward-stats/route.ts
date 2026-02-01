/**
 * Admin endpoint to get reward statistics for the payout pipeline.
 */

import { NextResponse } from "next/server";
import { requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";
import { ALL_REWARD_TYPES } from "@/lib/claimables";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    // Count PAID unclaimed rewards
    const paidUnclaimed = await db.rewardEvent.count({
      where: {
        status: "PAID",
        claimedAt: null,
        type: { in: ALL_REWARD_TYPES },
      },
    });

    // Count PAID claimed rewards
    const paidClaimed = await db.rewardEvent.count({
      where: {
        status: "PAID",
        claimedAt: { not: null },
        type: { in: ALL_REWARD_TYPES },
      },
    });

    // Count PENDING rewards (not yet distributed)
    const pending = await db.rewardEvent.count({
      where: {
        status: "PENDING",
        type: { in: ALL_REWARD_TYPES },
      },
    });

    // Get unique users with PAID unclaimed rewards
    const usersWithRewards = await db.rewardEvent.groupBy({
      by: ["userId"],
      where: {
        status: "PAID",
        claimedAt: null,
        type: { in: ALL_REWARD_TYPES },
      },
    });

    // Get unique weekKeys
    const weekKeys = await db.rewardEvent.groupBy({
      by: ["weekKey"],
      where: {
        status: "PAID",
        claimedAt: null,
        type: { in: ALL_REWARD_TYPES },
      },
      orderBy: { weekKey: "desc" },
    });

    // Also get ALL statuses for debugging
    const allStatuses = await db.rewardEvent.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    return NextResponse.json({
      ok: true,
      paidUnclaimed,
      paidClaimed,
      pending,
      totalUsers: usersWithRewards.length,
      weekKeys: weekKeys.map(w => w.weekKey),
      debug: {
        allStatuses: allStatuses.map(s => ({ status: s.status, count: s._count.status })),
        memberRewardTypes: ALL_REWARD_TYPES,
      },
    });
  } catch (e) {
    console.error("Reward stats error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
