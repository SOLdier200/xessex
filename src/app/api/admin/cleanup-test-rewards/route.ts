/**
 * Admin endpoint to clean up test reward data and optionally reset/delete real rewards for testing
 *
 * POST /api/admin/cleanup-test-rewards
 * Body: {
 *   resetRealRewards?: boolean,  // Reset claimedAt to null for a weekKey
 *   weekKey?: string,            // Required for resetRealRewards or deleteWeekKey
 *   deleteWeekKey?: boolean,     // DELETE all PAID unclaimed rewards for a specific weekKey
 *   deleteAllOldRewards?: boolean // DELETE all PAID unclaimed rewards from ALL weekKeys (nuclear option)
 * }
 *
 * - Always deletes TEST_COPY, TEST, TEST_EPOCH_* refTypes
 * - Always deletes test-* weekKey records
 * - If resetRealRewards=true, sets claimedAt=null on real rewards for the specified weekKey
 * - If deleteWeekKey=true, deletes all PAID unclaimed rewards for the specified weekKey
 * - If deleteAllOldRewards=true, deletes all PAID unclaimed rewards from all weekKeys (use with caution!)
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
  const deleteWeekKey = body.deleteWeekKey === true;
  const deleteAllOldRewards = body.deleteAllOldRewards === true;
  const clearEpochsForWeekKey = body.clearEpochsForWeekKey as string | undefined;
  const nuclearReset = body.nuclearReset === true; // Deletes EVERYTHING - rewards, epochs, batches

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

    // 5. Delete test epochs and their leaves (including ones with test-* weekKeys OR setOnChain that aren't real)
    const testEpochs = await db.claimEpoch.findMany({
      where: {
        OR: [
          { weekKey: { startsWith: "test" } },
          // Also allow deleting epochs that are marked on-chain but for non-production weekKeys
          // This helps reset the testing state
        ],
      },
      select: { epoch: true, weekKey: true, setOnChain: true },
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

    // 8. Optionally delete all PAID unclaimed rewards for a specific weekKey
    let deletedWeekKeyRewards = 0;
    if (deleteWeekKey && weekKey) {
      const deleted = await db.rewardEvent.deleteMany({
        where: {
          weekKey,
          status: "PAID",
          claimedAt: null,
        },
      });
      deletedWeekKeyRewards = deleted.count;
    }

    // 9. Optionally delete ALL PAID unclaimed rewards (nuclear option for testing)
    let deletedAllOldRewards = 0;
    const deletedWeekKeys: string[] = [];
    if (deleteAllOldRewards) {
      // First get list of affected weekKeys for reporting
      const affectedWeeks = await db.rewardEvent.groupBy({
        by: ["weekKey"],
        where: {
          status: "PAID",
          claimedAt: null,
          weekKey: { not: { startsWith: "test" } },
        },
        _count: { id: true },
      });
      for (const w of affectedWeeks) {
        deletedWeekKeys.push(`${w.weekKey} (${w._count.id} rewards)`);
      }

      // Delete all PAID unclaimed rewards
      const deleted = await db.rewardEvent.deleteMany({
        where: {
          status: "PAID",
          claimedAt: null,
          weekKey: { not: { startsWith: "test" } },
        },
      });
      deletedAllOldRewards = deleted.count;
    }

    // 10. Clear epochs for a specific weekKey (allows re-running weekly-distribute)
    let clearedEpochsForWeekKey = 0;
    if (clearEpochsForWeekKey) {
      const epochsToDelete = await db.claimEpoch.findMany({
        where: { weekKey: clearEpochsForWeekKey },
        select: { epoch: true },
      });

      for (const e of epochsToDelete) {
        await db.claimLeaf.deleteMany({ where: { epoch: e.epoch } });
        await db.claimSalt.deleteMany({ where: { epoch: e.epoch } });
        await db.claimEpoch.delete({ where: { epoch: e.epoch } }).catch(() => {});
        clearedEpochsForWeekKey++;
      }

      // Also delete the reward batch so weekly-distribute can run fresh
      await db.rewardBatch.deleteMany({ where: { weekKey: clearEpochsForWeekKey } });
    }

    // 11. Nuclear reset - delete ALL rewards, epochs, batches (for complete testing reset)
    let nuclearDeletedRewards = 0;
    let nuclearDeletedEpochs = 0;
    let nuclearDeletedBatches = 0;
    if (nuclearReset) {
      // Delete all claim leaves first
      await db.claimLeaf.deleteMany({});

      // Delete all claim salts
      await db.claimSalt.deleteMany({});

      // Delete all claim epochs
      const epochCount = await db.claimEpoch.deleteMany({});
      nuclearDeletedEpochs = epochCount.count;

      // Delete all reward events
      const rewardCount = await db.rewardEvent.deleteMany({});
      nuclearDeletedRewards = rewardCount.count;

      // Delete all reward batches
      const batchCount = await db.rewardBatch.deleteMany({});
      nuclearDeletedBatches = batchCount.count;

      // Reset paidAtomic on all stats
      await db.weeklyUserStat.updateMany({
        data: { paidAtomic: 0n },
      });
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

    // Build message
    let message = "Cleaned up test data.";
    if (resetCount > 0) {
      message += ` Reset ${resetCount} rewards for ${weekKey}.`;
    }
    if (deletedWeekKeyRewards > 0) {
      message += ` Deleted ${deletedWeekKeyRewards} PAID unclaimed rewards for ${weekKey}.`;
    }
    if (deletedAllOldRewards > 0) {
      message += ` Deleted ${deletedAllOldRewards} PAID unclaimed rewards from all weekKeys.`;
    }
    if (clearedEpochsForWeekKey > 0) {
      message += ` Cleared ${clearedEpochsForWeekKey} epochs for ${clearEpochsForWeekKey}.`;
    }
    if (nuclearReset) {
      message = `NUCLEAR RESET: Deleted ${nuclearDeletedRewards} rewards, ${nuclearDeletedEpochs} epochs, ${nuclearDeletedBatches} batches.`;
    }

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
        weekKeyRewards: deletedWeekKeyRewards,
        allOldRewards: deletedAllOldRewards,
        affectedWeekKeys: deletedWeekKeys,
        clearedEpochsForWeekKey,
        nuclearRewards: nuclearDeletedRewards,
        nuclearEpochs: nuclearDeletedEpochs,
        nuclearBatches: nuclearDeletedBatches,
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
      message,
    });
  } catch (e) {
    console.error("Cleanup error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
