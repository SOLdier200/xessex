/**
 * Admin endpoint to clean up test reward data and optionally reset real rewards for testing
 *
 * POST /api/admin/cleanup-test-rewards
 * Body: { resetRealRewards?: boolean, weekKey?: string }
 *
 * - Always deletes TEST_COPY, TEST, TEST_EPOCH_* refTypes
 * - Always deletes test-* weekKey records
 * - If resetRealRewards=true, sets claimedAt=null on real rewards for the specified weekKey
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const resetRealRewards = body.resetRealRewards === true;
  const weekKey = body.weekKey as string | undefined;

  try {
    // 1. Delete TEST_COPY rewards
    const deletedTestCopies = await db.rewardEvent.deleteMany({
      where: { refType: "TEST_COPY" },
    });

    // 2. Delete TEST refType rewards
    const deletedTestRefType = await db.rewardEvent.deleteMany({
      where: { refType: "TEST" },
    });

    // 3. Delete TEST_EPOCH_* refType rewards
    const deletedTestEpochRefType = await db.rewardEvent.deleteMany({
      where: { refType: { startsWith: "TEST_EPOCH" } },
    });

    // 4. Delete test-* weekKey rewards
    const deletedTestWeeks = await db.rewardEvent.deleteMany({
      where: { weekKey: { startsWith: "test" } },
    });

    // 5. Delete test epochs and their leaves
    const testEpochs = await db.claimEpoch.findMany({
      where: { weekKey: { startsWith: "test" } },
      select: { epoch: true, weekKey: true },
    });

    let deletedLeaves = 0;
    let deletedEpochs = 0;
    const deletedEpochNumbers: number[] = [];

    for (const e of testEpochs) {
      const leaves = await db.claimLeaf.deleteMany({ where: { epoch: e.epoch } });
      deletedLeaves += leaves.count;
      await db.claimEpoch.delete({ where: { epoch: e.epoch } }).catch(() => {});
      deletedEpochs++;
      deletedEpochNumbers.push(e.epoch);
    }

    // 6. Delete test salts
    const testSalts = await db.claimSalt.deleteMany({
      where: { epoch: { in: deletedEpochNumbers } },
    });

    // 7. Optionally reset real rewards for testing
    let resetCount = 0;
    if (resetRealRewards && weekKey) {
      const reset = await db.rewardEvent.updateMany({
        where: {
          weekKey,
          status: "PAID",
          claimedAt: { not: null },
        },
        data: { claimedAt: null },
      });
      resetCount = reset.count;
    }

    // Get remaining real rewards summary
    const realRewardsRemaining = await db.rewardEvent.groupBy({
      by: ["weekKey"],
      where: {
        status: "PAID",
        weekKey: { not: { startsWith: "test" } },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    return NextResponse.json({
      ok: true,
      deleted: {
        testCopyRewards: deletedTestCopies.count,
        testRefTypeRewards: deletedTestRefType.count,
        testEpochRefTypeRewards: deletedTestEpochRefType.count,
        testWeekRewards: deletedTestWeeks.count,
        testEpochs: deletedEpochs,
        testLeaves: deletedLeaves,
        testSalts: testSalts.count,
      },
      resetRealRewards: resetRealRewards ? {
        weekKey,
        count: resetCount,
      } : null,
      realRewardsRemaining: realRewardsRemaining.map(r => ({
        weekKey: r.weekKey,
        count: r._count.id,
        totalXess: r._sum.amount ? `${(Number(r._sum.amount) / 1_000_000).toLocaleString()} XESS` : "0",
      })),
      message: "Cleaned up test data." + (resetCount > 0 ? ` Reset ${resetCount} rewards for ${weekKey}.` : ""),
    });
  } catch (e) {
    console.error("Cleanup error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
