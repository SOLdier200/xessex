import { NextRequest, NextResponse } from "next/server";
import { markActionRun, requireAdminOrMod } from "@/lib/adminActions";
import { weekKeyUTC } from "@/lib/weekKey";

export const runtime = "nodejs";

// Genesis date for weekIndex calculation (first week of rewards)
// Must be a Monday to match weekKeyUTC() convention
const GENESIS_MONDAY = "2026-01-19";

function normalizeWeekKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return weekKeyUTC(d);
}

function computeWeekIndex(weekKey: string): number {
  const genesis = new Date(`${GENESIS_MONDAY}T00:00:00Z`);
  const target = new Date(`${weekKey}T00:00:00Z`);
  if (Number.isNaN(genesis.getTime()) || Number.isNaN(target.getTime())) return 0;
  const diffMs = target.getTime() - genesis.getTime();
  const weekIndex = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, weekIndex);
}

/**
 * POST: Run weekly distribute as a "makeup" payout.
 * Uses stats from sourceWeekKey but writes rewards to payoutWeekKey.
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
    sourceWeekKey?: string;
    payoutWeekKey?: string;
    force?: boolean;
  } | null;

  const sourceWeekKey = normalizeWeekKey(body?.sourceWeekKey);
  const payoutWeekKey = normalizeWeekKey(body?.payoutWeekKey);
  const force = body?.force === true;

  if (!sourceWeekKey || !payoutWeekKey) {
    return NextResponse.json(
      { ok: false, error: "MISSING_PARAMS", required: ["sourceWeekKey", "payoutWeekKey"] },
      { status: 400 }
    );
  }

  const weekIndex = computeWeekIndex(sourceWeekKey);

  try {
    const url = new URL("http://internal/api/cron/rewards/weekly-distribute");
    url.searchParams.set("weekKey", payoutWeekKey);
    url.searchParams.set("statsWeekKey", sourceWeekKey);
    url.searchParams.set("weekIndex", String(weekIndex));
    if (force) url.searchParams.set("force", "1");

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
      return NextResponse.json({ ok: false, error: msg, message: payload?.message }, { status: res.status });
    }

    const msg = `Makeup payout created for stats ${sourceWeekKey} → payout ${payoutWeekKey}`;
    await markActionRun("RECOMPUTE_REWARDS_EPOCH", true, msg);
    return NextResponse.json({
      ok: true,
      message: msg,
      sourceWeekKey,
      payoutWeekKey,
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
