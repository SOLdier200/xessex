/**
 * Cron endpoint to build a new claim epoch.
 * Protected with CRON_SECRET.
 *
 * Usage:
 *   curl -X POST "http://localhost:3001/api/cron/claims/build-epoch" \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET"
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

    // Advisory lock to prevent concurrent epoch builds
    // Using a stable lock ID
    const lockId = 9007199254740991n;

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
        });
      }

      // Determine next epoch number
      const lastEpoch = await getLatestEpoch();
      const nextEpoch = (lastEpoch?.epoch ?? 0) + 1;

      const result = await buildAndStoreClaimEpoch({ epoch: nextEpoch, weekKey });

      return NextResponse.json({
        ...result,
        weekKey,
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

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * GET handler for checking latest epoch status.
 */
export async function GET(req: Request) {
  try {
    assertCron(req);

    const latest = await getLatestEpoch();

    if (!latest) {
      return NextResponse.json({ ok: true, latestEpoch: null });
    }

    return NextResponse.json({
      ok: true,
      latestEpoch: {
        epoch: latest.epoch,
        rootHex: latest.rootHex,
        totalAtomic: latest.totalAtomic.toString(),
        leafCount: latest.leafCount,
        setOnChain: latest.setOnChain,
        createdAt: latest.createdAt.toISOString(),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown error";

    if (message === "unauthorized") {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
