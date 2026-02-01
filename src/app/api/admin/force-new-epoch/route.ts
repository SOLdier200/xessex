/**
 * Admin endpoint to force a new epoch number for testing.
 * Deletes any existing non-on-chain epoch for the pending weekKey
 * so that build-claim-epoch-v2 will create a fresh epoch.
 */

import { NextResponse } from "next/server";
import { requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";
import { getNextEpochNumber } from "@/lib/epochRoot";
import { MEMBER_REWARD_TYPES } from "@/lib/claimables";

export const runtime = "nodejs";

/**
 * GET: Return what the next epoch number would be
 */
export async function GET() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    // Find pending weekKey
    const latestReward = await db.rewardEvent.findFirst({
      where: { status: "PAID", claimedAt: null, type: { in: MEMBER_REWARD_TYPES } },
      orderBy: { weekKey: "desc" },
      select: { weekKey: true },
    });

    const pendingWeekKey = latestReward?.weekKey || null;

    // Check existing epoch for this weekKey
    const existingEpoch = pendingWeekKey
      ? await db.claimEpoch.findUnique({
          where: { weekKey_version: { weekKey: pendingWeekKey, version: 2 } },
        })
      : null;

    // Get next epoch number
    const lastEpoch = await db.claimEpoch.findFirst({ orderBy: { epoch: "desc" } });
    const nextEpoch = await getNextEpochNumber(lastEpoch?.epoch ?? null);

    return NextResponse.json({
      ok: true,
      pendingWeekKey,
      existingEpoch: existingEpoch
        ? {
            epoch: existingEpoch.epoch,
            setOnChain: existingEpoch.setOnChain,
            canDelete: !existingEpoch.setOnChain,
          }
        : null,
      nextEpochNumber: nextEpoch,
      wouldCreateNewEpoch: !existingEpoch,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

/**
 * POST: Delete existing non-on-chain epoch for the pending weekKey
 * This allows build-claim-epoch-v2 to create a fresh epoch number.
 */
export async function POST() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    // Find pending weekKey
    const latestReward = await db.rewardEvent.findFirst({
      where: { status: "PAID", claimedAt: null, type: { in: MEMBER_REWARD_TYPES } },
      orderBy: { weekKey: "desc" },
      select: { weekKey: true },
    });

    if (!latestReward?.weekKey) {
      return NextResponse.json({
        ok: false,
        error: "NO_PENDING_REWARDS",
        message: "No PAID rewards to build epoch for",
      }, { status: 400 });
    }

    const weekKey = latestReward.weekKey;

    // Check existing epoch
    const existingEpoch = await db.claimEpoch.findUnique({
      where: { weekKey_version: { weekKey, version: 2 } },
    });

    if (!existingEpoch) {
      // No epoch exists, next build will create new one
      const lastEpoch = await db.claimEpoch.findFirst({ orderBy: { epoch: "desc" } });
      const nextEpoch = await getNextEpochNumber(lastEpoch?.epoch ?? null);

      return NextResponse.json({
        ok: true,
        action: "none_needed",
        message: "No existing epoch for this weekKey, build will create new one",
        weekKey,
        nextEpochNumber: nextEpoch,
      });
    }

    if (existingEpoch.setOnChain) {
      return NextResponse.json({
        ok: false,
        error: "EPOCH_ON_CHAIN",
        message: `Epoch ${existingEpoch.epoch} is already on-chain and cannot be deleted`,
        epoch: existingEpoch.epoch,
      }, { status: 400 });
    }

    // Delete the existing epoch and its leaves
    const deletedLeaves = await db.claimLeaf.deleteMany({
      where: { epoch: existingEpoch.epoch },
    });

    await db.claimEpoch.delete({
      where: { epoch: existingEpoch.epoch },
    });

    // Get the new next epoch number
    const lastEpoch = await db.claimEpoch.findFirst({ orderBy: { epoch: "desc" } });
    const nextEpoch = await getNextEpochNumber(lastEpoch?.epoch ?? null);

    return NextResponse.json({
      ok: true,
      action: "deleted",
      message: `Deleted epoch ${existingEpoch.epoch} and ${deletedLeaves.count} leaves`,
      deletedEpoch: existingEpoch.epoch,
      deletedLeaves: deletedLeaves.count,
      weekKey,
      nextEpochNumber: nextEpoch,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
