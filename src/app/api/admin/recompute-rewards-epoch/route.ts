import { NextRequest, NextResponse } from "next/server";
import { markActionRun, requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";
import { weekKeyUTC, weekKeySundayMidnightPT, getPayoutPeriod, periodKeyPT, parsePeriodKey } from "@/lib/weekKey";

export const runtime = "nodejs";

// Genesis date for weekIndex calculation (first week of rewards)
// Uses Sunday as week start to match weekKeySundayMidnightPT() convention
const GENESIS_SUNDAY = "2026-01-19"; // First Sunday (genesis week)

/**
 * Parse and normalize a weekKey input to Sunday format using weekKeySundayMidnightPT
 * This ensures consistency with twice-weekly payout periods
 */
function normalizeWeekKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00Z`); // Use noon to avoid timezone edge cases
  if (Number.isNaN(d.getTime())) return null;
  // Normalize to Sunday using the same helper as periodKey
  return weekKeySundayMidnightPT(d);
}

/**
 * Check if a string is a period key (YYYY-MM-DD-P1 or YYYY-MM-DD-P2)
 */
function isPeriodKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}-P[12]$/.test(value);
}

/**
 * Compute weekIndex from genesis Sunday
 * Week 0 = GENESIS_SUNDAY, Week 1 = GENESIS_SUNDAY + 7 days, etc.
 */
function computeWeekIndex(weekKey: string): number {
  const genesis = new Date(`${GENESIS_SUNDAY}T00:00:00Z`);
  const target = new Date(`${weekKey}T00:00:00Z`);

  if (Number.isNaN(genesis.getTime()) || Number.isNaN(target.getTime())) {
    return 0;
  }

  const diffMs = target.getTime() - genesis.getTime();
  const weekIndex = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, weekIndex);
}

/**
 * GET: Return week/period info for UI (twice-weekly payouts)
 */
export async function GET() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();

  // Use Sunday-based weekKey for twice-weekly payout periods
  const thisWeekKey = weekKeySundayMidnightPT(now);
  const currentPeriod = getPayoutPeriod(now);
  const currentPeriodKey = periodKeyPT(now);

  // Last week
  const lastWeekDate = new Date(now);
  lastWeekDate.setUTCDate(lastWeekDate.getUTCDate() - 7);
  const lastWeekKey = weekKeySundayMidnightPT(lastWeekDate);

  const thisWeekIndex = computeWeekIndex(thisWeekKey);
  const lastWeekIndex = computeWeekIndex(lastWeekKey);

  // Check if batches already exist (now checking period keys)
  const [thisWeekP1Batch, thisWeekP2Batch, lastWeekP1Batch, lastWeekP2Batch] = await Promise.all([
    db.rewardBatch.findUnique({ where: { weekKey: `${thisWeekKey}-P1` } }),
    db.rewardBatch.findUnique({ where: { weekKey: `${thisWeekKey}-P2` } }),
    db.rewardBatch.findUnique({ where: { weekKey: `${lastWeekKey}-P1` } }),
    db.rewardBatch.findUnique({ where: { weekKey: `${lastWeekKey}-P2` } }),
  ]);

  return NextResponse.json({
    ok: true,
    currentPeriodKey,
    currentPeriod,
    thisWeek: {
      weekKey: thisWeekKey,
      weekIndex: thisWeekIndex,
      periods: {
        P1: {
          periodKey: `${thisWeekKey}-P1`,
          batchExists: !!thisWeekP1Batch,
          batchStatus: thisWeekP1Batch?.status,
        },
        P2: {
          periodKey: `${thisWeekKey}-P2`,
          batchExists: !!thisWeekP2Batch,
          batchStatus: thisWeekP2Batch?.status,
        },
      },
    },
    lastWeek: {
      weekKey: lastWeekKey,
      weekIndex: lastWeekIndex,
      periods: {
        P1: {
          periodKey: `${lastWeekKey}-P1`,
          batchExists: !!lastWeekP1Batch,
          batchStatus: lastWeekP1Batch?.status,
        },
        P2: {
          periodKey: `${lastWeekKey}-P2`,
          batchExists: !!lastWeekP2Batch,
          batchStatus: lastWeekP2Batch?.status,
        },
      },
    },
  });
}

/**
 * POST: Run twice-weekly distribute for a given periodKey
 * weekIndex is computed automatically from the week portion
 *
 * Body params:
 * - periodKey: "YYYY-MM-DD-P1" or "YYYY-MM-DD-P2" (new format, preferred)
 * - weekKey: "YYYY-MM-DD" (legacy format, defaults to P1)
 * - force: boolean to rerun existing batch
 */
export async function POST(req: NextRequest) {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    await markActionRun("RECOMPUTE_REWARDS_EPOCH", false, "Missing CRON_SECRET");
    return NextResponse.json(
      { ok: false, error: "MISSING_CRON_SECRET" },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    periodKey?: string;
    weekKey?: string;
    force?: boolean;
  } | null;

  const force = body?.force === true;

  // Determine the periodKey to use
  let periodKey: string;
  let weekKey: string;
  let period: 1 | 2;

  if (body?.periodKey && isPeriodKey(body.periodKey)) {
    // New format: use provided periodKey
    periodKey = body.periodKey;
    try {
      const parsed = parsePeriodKey(periodKey);
      weekKey = parsed.weekKey;
      period = parsed.period;
    } catch (e) {
      return NextResponse.json({
        ok: false,
        error: "INVALID_PERIOD_KEY",
        message: (e as Error).message,
      }, { status: 400 });
    }
  } else if (body?.weekKey) {
    // Legacy format: normalize weekKey and default to P1
    weekKey = normalizeWeekKey(body.weekKey) || weekKeySundayMidnightPT(new Date());
    period = 1;
    periodKey = `${weekKey}-P1`;
    console.log(`[recompute-rewards-epoch] Legacy weekKey format, using periodKey=${periodKey}`);
  } else {
    // No input: use current period
    periodKey = periodKeyPT(new Date());
    const parsed = parsePeriodKey(periodKey);
    weekKey = parsed.weekKey;
    period = parsed.period;
  }

  // Compute weekIndex from the week portion
  const weekIndex = computeWeekIndex(weekKey);

  console.log(`[recompute-rewards-epoch] INPUT periodKey: ${body?.periodKey || "not provided"}`);
  console.log(`[recompute-rewards-epoch] CANONICAL periodKey: ${periodKey}, weekKey: ${weekKey}, period: ${period}, weekIndex: ${weekIndex}`);

  // Check if batch already exists (unless force is set)
  if (!force) {
    const existingBatch = await db.rewardBatch.findUnique({ where: { weekKey: periodKey } });
    if (existingBatch) {
      return NextResponse.json({
        ok: false,
        error: "BATCH_EXISTS",
        message: `Batch already exists for ${periodKey}. Use force=true to rerun.`,
        periodKey,
        weekKey,
        period,
        weekIndex,
      }, { status: 409 });
    }
  }

  try {
    const url = new URL("http://internal/api/cron/rewards/weekly-distribute");
    url.searchParams.set("periodKey", periodKey);
    url.searchParams.set("weekIndex", String(weekIndex));
    if (force) {
      url.searchParams.set("force", "1");
    }

    const cronReq = new Request(url.toString(), {
      method: "POST",
      headers: { "x-cron-secret": cronSecret },
    });

    const mod = await import("@/app/api/cron/rewards/weekly-distribute/route");
    const res: Response = await mod.POST(cronReq as unknown as NextRequest);
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = payload?.error || `weekly-distribute failed (${res.status})`;
      await markActionRun("RECOMPUTE_REWARDS_EPOCH", false, msg);
      return NextResponse.json({ ok: false, error: msg, message: payload?.message }, { status: 500 });
    }

    const msg = `Rewards computed for ${periodKey} (P${period} of week ${weekKey}, index ${weekIndex})`;
    await markActionRun("RECOMPUTE_REWARDS_EPOCH", true, msg);
    return NextResponse.json({
      ok: true,
      message: msg,
      periodKey,
      weekKey,
      period,
      weekIndex,
      detail: payload,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    await markActionRun("RECOMPUTE_REWARDS_EPOCH", false, msg);
    return NextResponse.json(
      { ok: false, error: "FAILED_TO_RECOMPUTE_REWARDS", message: msg },
      { status: 500 }
    );
  }
}
