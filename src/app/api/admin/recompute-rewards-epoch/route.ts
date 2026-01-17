import { NextRequest, NextResponse } from "next/server";
import { markActionRun, requireAdminOrMod } from "@/lib/adminActions";
import { weekKeyUTC } from "@/lib/weekKey";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

function parseWeekKey(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return value;
}

async function inferWeekIndex(weekKey: string) {
  const earliest = await db.rewardBatch.findFirst({
    orderBy: { weekKey: "asc" },
    select: { weekKey: true },
  });

  if (!earliest?.weekKey) return 0;

  const start = new Date(`${earliest.weekKey}T00:00:00Z`);
  const target = new Date(`${weekKey}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(target.getTime())) return null;

  const diffMs = target.getTime() - start.getTime();
  if (diffMs < 0) return null;

  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Recompute rewards epoch by reusing the weekly distribute logic.
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
    weekIndex?: number;
  } | null;

  const weekKey = parseWeekKey(body?.weekKey) || weekKeyUTC(new Date());
  const weekIndex =
    typeof body?.weekIndex === "number"
      ? body.weekIndex
      : await inferWeekIndex(weekKey);

  if (weekIndex === null || weekIndex < 0) {
    await markActionRun("RECOMPUTE_REWARDS_EPOCH", false, "Invalid weekIndex");
    return NextResponse.json(
      { ok: false, error: "INVALID_WEEK_INDEX" },
      { status: 400 }
    );
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
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    const msg =
      payload?.message ||
      `Rewards recomputed for ${weekKey} (index ${weekIndex})`;
    await markActionRun("RECOMPUTE_REWARDS_EPOCH", true, msg);
    return NextResponse.json({ ok: true, message: msg, detail: payload });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    await markActionRun("RECOMPUTE_REWARDS_EPOCH", false, msg);
    return NextResponse.json(
      { ok: false, error: "FAILED_TO_RECOMPUTE_REWARDS" },
      { status: 500 }
    );
  }
}
