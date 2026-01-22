/**
 * Admin endpoint to build a claim epoch.
 * Session-protected (admin/mod only) - no CRON_SECRET needed.
 */

import { NextResponse } from "next/server";
import { markActionRun, requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";
import { buildAndStoreClaimEpoch, getLatestEpoch } from "@/lib/claimEpochBuilder";

export const runtime = "nodejs";

export async function POST() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    // Find the latest weekKey with PAID, unclaimed rewards
    const latestReward = await db.rewardEvent.findFirst({
      where: { status: "PAID", claimedAt: null },
      orderBy: { weekKey: "desc" },
      select: { weekKey: true },
    });

    if (!latestReward?.weekKey) {
      await markActionRun("BUILD_CLAIM_EPOCH", true, "No PAID rewards to build epoch for");
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "no_paid_rewards",
      });
    }

    const weekKey = latestReward.weekKey;

    // Check if epoch already exists for this weekKey
    const existingEpoch = await db.claimEpoch.findUnique({ where: { weekKey } });
    if (existingEpoch) {
      await markActionRun("BUILD_CLAIM_EPOCH", true, `Epoch ${existingEpoch.epoch} already exists for ${weekKey}`);
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "epoch_exists",
        weekKey,
        epoch: existingEpoch.epoch,
        rootHex: existingEpoch.rootHex,
        setOnChain: existingEpoch.setOnChain,
      });
    }

    // Determine next epoch number
    const lastEpoch = await getLatestEpoch();
    const epoch = (lastEpoch?.epoch ?? 0) + 1;

    // Build and store the epoch
    const built = await buildAndStoreClaimEpoch({ epoch, weekKey });

    const msg = `Built epoch ${epoch} for ${weekKey}: ${built.leafCount} leaves, root=${built.rootHex?.slice(0, 16)}...`;
    await markActionRun("BUILD_CLAIM_EPOCH", true, msg);

    return NextResponse.json({
      ok: true,
      weekKey,
      epoch,
      rootHex: built.rootHex,
      leafCount: built.leafCount,
      totalAtomic: built.totalAtomic,
      nextStep: `Run: node solana-programs/xess-claim/set-epoch-root.mjs ${epoch} ${built.rootHex}`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await markActionRun("BUILD_CLAIM_EPOCH", false, message);

    // "No claimables" is expected if no PAID rewards exist
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
 * GET: Check status of claim epochs and pending rewards
 */
export async function GET() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Find latest weekKey with PAID, unclaimed rewards
  const latestReward = await db.rewardEvent.findFirst({
    where: { status: "PAID", claimedAt: null },
    orderBy: { weekKey: "desc" },
    select: { weekKey: true },
  });

  const latestEpoch = await getLatestEpoch();

  // Check if the latest reward weekKey has an epoch
  const pendingWeekKey = latestReward?.weekKey;
  const pendingEpoch = pendingWeekKey
    ? await db.claimEpoch.findUnique({ where: { weekKey: pendingWeekKey } })
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
        }
      : null,
  });
}
