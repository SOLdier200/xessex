/**
 * Weekly Cron Endpoint: Build claim epoch from latest PAID rewards
 *
 * DATA-DRIVEN APPROACH:
 * - Finds the latest weekKey that has PAID, unclaimed RewardEvents
 * - Builds merkle epoch for that exact weekKey
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
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { buildAndStoreClaimEpoch, getLatestEpoch } from "@/lib/claimEpochBuilder";

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
      if (existingEpoch) {
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

      // Return result with next step reminder
      return NextResponse.json({
        ok: true,
        weekKey,
        epoch,
        built,
        nextStep: "call_set_epoch_root_onchain",
        instructions: `Run: node set-epoch-root.mjs ${epoch} ${built.rootHex}`,
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
            rootHex: latestEpoch.rootHex,
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
