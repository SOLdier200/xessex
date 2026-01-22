import { NextRequest, NextResponse } from "next/server";
import { markActionRun, requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";
import { weekKeyUTC } from "@/lib/weekKey";

export const runtime = "nodejs";

// Genesis date for weekIndex calculation (first week of rewards)
// Must be a Monday to match weekKeyUTC() convention
const GENESIS_MONDAY = "2026-01-19"; // First Monday

/**
 * Parse and normalize a weekKey input to Monday format using weekKeyUTC
 * This ensures consistency with the comments route and other stats
 */
function normalizeWeekKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Normalize to Monday using the same helper as comments route
  return weekKeyUTC(d);
}

/**
 * Compute weekIndex from genesis Monday
 * Week 0 = GENESIS_MONDAY, Week 1 = GENESIS_MONDAY + 7 days, etc.
 */
function computeWeekIndex(weekKey: string): number {
  const genesis = new Date(`${GENESIS_MONDAY}T00:00:00Z`);
  const target = new Date(`${weekKey}T00:00:00Z`);

  if (Number.isNaN(genesis.getTime()) || Number.isNaN(target.getTime())) {
    return 0;
  }

  const diffMs = target.getTime() - genesis.getTime();
  const weekIndex = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, weekIndex);
}

/**
 * GET: Return week info for UI
 */
export async function GET() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  // Use weekKeyUTC for Monday-based keys (matches comments route)
  const thisWeekKey = weekKeyUTC(now);

  // Last week
  const lastWeekDate = new Date(now);
  lastWeekDate.setUTCDate(lastWeekDate.getUTCDate() - 7);
  const lastWeekKey = weekKeyUTC(lastWeekDate);

  const thisWeekIndex = computeWeekIndex(thisWeekKey);
  const lastWeekIndex = computeWeekIndex(lastWeekKey);

  // Check if batches already exist
  const [thisWeekBatch, lastWeekBatch] = await Promise.all([
    db.rewardBatch.findUnique({ where: { weekKey: thisWeekKey } }),
    db.rewardBatch.findUnique({ where: { weekKey: lastWeekKey } }),
  ]);

  return NextResponse.json({
    ok: true,
    thisWeek: {
      weekKey: thisWeekKey,
      weekIndex: thisWeekIndex,
      batchExists: !!thisWeekBatch,
    },
    lastWeek: {
      weekKey: lastWeekKey,
      weekIndex: lastWeekIndex,
      batchExists: !!lastWeekBatch,
    },
  });
}

/**
 * POST: Run weekly distribute for a given weekKey
 * weekIndex is computed automatically
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
    weekKey?: string;
    force?: boolean;
  } | null;

  // Normalize weekKey to Monday format (matches comments route)
  // If no weekKey provided, use current week
  const weekKey = normalizeWeekKey(body?.weekKey) || weekKeyUTC(new Date());
  const force = body?.force === true;

  // Compute weekIndex automatically
  const weekIndex = computeWeekIndex(weekKey);

  console.log(`[recompute-rewards-epoch] INPUT weekKey: ${body?.weekKey || "not provided"}`);
  console.log(`[recompute-rewards-epoch] CANONICAL weekKey: ${weekKey}, weekIndex: ${weekIndex}`);

  // Check if batch already exists (unless force is set)
  if (!force) {
    const existingBatch = await db.rewardBatch.findUnique({ where: { weekKey } });
    if (existingBatch) {
      return NextResponse.json({
        ok: false,
        error: "BATCH_EXISTS",
        message: `Batch already exists for ${weekKey}. Use force=true to rerun.`,
        weekKey,
        weekIndex,
      }, { status: 409 });
    }
  }

  try {
    const url = new URL("http://internal/api/cron/rewards/weekly-distribute");
    url.searchParams.set("weekKey", weekKey);
    url.searchParams.set("weekIndex", String(weekIndex));

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

    const msg = `Rewards computed for ${weekKey} (index ${weekIndex})`;
    await markActionRun("RECOMPUTE_REWARDS_EPOCH", true, msg);
    return NextResponse.json({
      ok: true,
      message: msg,
      weekKey,
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
