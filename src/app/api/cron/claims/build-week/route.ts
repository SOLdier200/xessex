/**
 * Weekly Cron Endpoint: Build claim epoch from latest PAID rewards (V2)
 *
 * DATA-DRIVEN APPROACH:
 * - Finds the latest weekKey that has PAID, unclaimed RewardEvents
 * - Builds merkle epoch for that exact weekKey using V2 format
 * - V2: userKey-based leaves (no wallet required, claim to any wallet)
 * - Guarantees alignment with weekly-distribute's weekKey format
 *
 * Schedule: Sunday 00:02 AM (and optionally 00:10 as retry)
 * Example cron:
 *   2 0 * * 0 curl -sS -X POST https://xessex.me/api/cron/claims/build-week -H "Authorization: Bearer $CRON_SECRET"
 *
 * After this runs successfully:
 *   1. Get the rootHex from the response
 *   2. Run set_epoch_root(epoch, rootHex) on-chain
 *   3. Mark epoch as setOnChain=true in DB
 *
 * V2 Features:
 * - Rebuild-until-published: Can rebuild freely until setOnChain=true
 * - Salt stability: ClaimSalt table ensures same salt per (epoch, user)
 * - buildHash: Detects if inputs changed since last build
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { buildClaimEpochV2Safe, getLatestEpoch } from "@/lib/claimEpochBuilder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET not set");

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (token !== secret) {
    throw new Error("unauthorized");
  }
}

export async function POST(req: Request) {
  try {
    assertCron(req);

    // Advisory lock to prevent concurrent builds
    const lockId = 9100000000000001n;

    type LockResult = { pg_try_advisory_lock: boolean }[];
    const got = await db.$queryRawUnsafe<LockResult>(
      `SELECT pg_try_advisory_lock(${lockId.toString()})`
    );

    if (!got?.[0]?.pg_try_advisory_lock) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "lock_busy",
      });
    }

    try {
      // DATA-DRIVEN: Find the latest weekKey with PAID, unclaimed rewards
      const latestReward = await db.rewardEvent.findFirst({
        where: { status: "PAID", claimedAt: null },
        orderBy: { weekKey: "desc" },
        select: { weekKey: true },
      });

      if (!latestReward?.weekKey) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "no_paid_rewards",
        });
      }

      const weekKey = latestReward.weekKey;

      // Check if epoch already exists for this weekKey
      const existingEpoch = await db.claimEpoch.findUnique({ where: { weekKey } });

      // Determine epoch number
      let epoch: number;
      if (existingEpoch) {
        // V2 allows rebuild if not yet on-chain
        if (existingEpoch.setOnChain) {
          return NextResponse.json({
            ok: true,
            skipped: true,
            reason: "epoch_immutable",
            weekKey,
            epoch: existingEpoch.epoch,
            rootHex: existingEpoch.rootHex,
            setOnChain: true,
          });
        }
        epoch = existingEpoch.epoch;
      } else {
        const lastEpoch = await getLatestEpoch();
        epoch = (lastEpoch?.epoch ?? 0) + 1;
      }

      // Build and store the epoch (V2 with userKey-based leaves)
      const built = await buildClaimEpochV2Safe({ epoch, weekKey });

      // Return result with next step reminder
      if (built.alreadyExists && !built.immutable) {
        return NextResponse.json({
          ok: true,
          skipped: false,
          reason: "rebuilt_same_inputs",
          weekKey,
          epoch: built.epoch,
          version: built.version,
          rootHex: built.rootHex,
          buildHash: built.buildHash,
          nextStep: "call_set_epoch_root_onchain",
          instructions: `Run: node set-epoch-root.mjs ${built.epoch} ${built.rootHex}`,
        });
      }

      return NextResponse.json({
        ok: true,
        weekKey,
        epoch: built.epoch,
        version: built.version,
        rootHex: built.rootHex,
        buildHash: built.buildHash,
        leafCount: built.leafCount,
        totalAtomic: built.totalAtomic,
        nextStep: "call_set_epoch_root_onchain",
        instructions: `Run: node set-epoch-root.mjs ${built.epoch} ${built.rootHex}`,
      });
    } finally {
      // Release advisory lock
      await db.$queryRawUnsafe(
        `SELECT pg_advisory_unlock(${lockId.toString()})`
      );
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown error";

    if (message === "unauthorized") {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // "No claimables" is expected if no PAID rewards exist yet
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
export async function GET(req: Request) {
  try {
    assertCron(req);

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
            version: latestEpoch.version ?? 1,
            rootHex: latestEpoch.rootHex,
            buildHash: latestEpoch.buildHash,
            totalAtomic: latestEpoch.totalAtomic.toString(),
            leafCount: latestEpoch.leafCount,
            setOnChain: latestEpoch.setOnChain,
            createdAt: latestEpoch.createdAt.toISOString(),
          }
        : null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown error";

    if (message === "unauthorized") {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
