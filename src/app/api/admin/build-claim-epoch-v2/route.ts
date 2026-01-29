/**
 * Admin endpoint to build a V2 (member) claim epoch.
 * Session-protected (admin/mod only) - no CRON_SECRET needed.
 */

import { NextResponse } from "next/server";
import { markActionRun, requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";
import { buildClaimEpochV2Safe } from "@/lib/claimEpochBuilder";
import { getNextEpochNumber } from "@/lib/epochRoot";
import { MEMBER_REWARD_TYPES } from "@/lib/claimables";

export const runtime = "nodejs";

export async function POST() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    // Find the latest weekKey with PAID, unclaimed MEMBER rewards
    const latestReward = await db.rewardEvent.findFirst({
      where: { status: "PAID", claimedAt: null, type: { in: MEMBER_REWARD_TYPES } },
      orderBy: { weekKey: "desc" },
      select: { weekKey: true },
    });

    if (!latestReward?.weekKey) {
      await markActionRun("BUILD_CLAIM_EPOCH_V2", true, "No PAID member rewards to build epoch for");
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "no_paid_rewards",
      });
    }

    const weekKey = latestReward.weekKey;

    // Check if epoch already exists for this weekKey (version 2)
    const existingEpoch = await db.claimEpoch.findUnique({
      where: { weekKey_version: { weekKey, version: 2 } },
    });

    let epoch: number;
    if (existingEpoch) {
      if (existingEpoch.setOnChain) {
        await markActionRun("BUILD_CLAIM_EPOCH_V2", true, `Epoch ${existingEpoch.epoch} already on-chain for ${weekKey}`);
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "epoch_immutable",
          weekKey,
          epoch: existingEpoch.epoch,
          rootHex: existingEpoch.rootHex,
          setOnChain: true,
          version: 2,
        });
      }
      epoch = existingEpoch.epoch;
    } else {
      // Determine next epoch number (safe: DB + on-chain)
      const lastEpoch = await db.claimEpoch.findFirst({ orderBy: { epoch: "desc" } });
      epoch = await getNextEpochNumber(lastEpoch?.epoch ?? null);
    }

    // Build and store the epoch (V2 / wallet-based)
    const built = await buildClaimEpochV2Safe({ epoch, weekKey });

    const msg = `Built v2 epoch ${built.epoch} for ${weekKey}: ${built.leafCount || 0} leaves, root=${built.rootHex?.slice(0, 16)}...`;
    await markActionRun("BUILD_CLAIM_EPOCH_V2", true, msg);

    return NextResponse.json({
      ok: true,
      weekKey,
      epoch: built.epoch,
      rootHex: built.rootHex,
      leafCount: built.leafCount,
      totalAtomic: built.totalAtomic,
      version: 2,
      buildHash: built.buildHash,
      nextStep: `Run: node solana-programs/xess-claim/set-epoch-root.mjs ${built.epoch} ${built.rootHex}`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await markActionRun("BUILD_CLAIM_EPOCH_V2", false, message);

    if (message.includes("No claimables")) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "no_claimables",
        message,
      });
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * GET: Check status of V2 claim epochs and pending rewards
 */
export async function GET() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Find latest weekKey with PAID, unclaimed MEMBER rewards
  const latestReward = await db.rewardEvent.findFirst({
    where: { status: "PAID", claimedAt: null, type: { in: MEMBER_REWARD_TYPES } },
    orderBy: { weekKey: "desc" },
    select: { weekKey: true },
  });

  const latestEpoch = await db.claimEpoch.findFirst({
    where: { version: 2 },
    orderBy: { epoch: "desc" },
  });

  // Check if the latest reward weekKey has an epoch
  const pendingWeekKey = latestReward?.weekKey;
  const pendingEpoch = pendingWeekKey
    ? await db.claimEpoch.findUnique({ where: { weekKey_version: { weekKey: pendingWeekKey, version: 2 } } })
    : null;

  return NextResponse.json({
    ok: true,
    pendingWeekKey,
    pendingEpochBuilt: !!pendingEpoch,
    pendingEpochSetOnChain: pendingEpoch?.setOnChain ?? false,
    latestEpoch: latestEpoch
      ? {
          epoch: latestEpoch.epoch,
          weekKey: latestEpoch.weekKey,
          rootHex: latestEpoch.rootHex,
          totalAtomic: latestEpoch.totalAtomic.toString(),
          leafCount: latestEpoch.leafCount,
          setOnChain: latestEpoch.setOnChain,
          onChainTxSig: latestEpoch.onChainTxSig,
          createdAt: latestEpoch.createdAt.toISOString(),
          version: 2,
        }
      : null,
  });
}
