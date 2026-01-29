import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { isAdminOrMod } from "@/lib/admin";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/admin/analytics/unlock-funnel
 *
 * Admin analytics for unlock funnel:
 * - Event counts (impressions, clicks, success, fail, etc.)
 * - Revenue summary (credits spent, avg cost)
 */
export async function GET(req: NextRequest) {
  const ctx = await getAccessContext();

  if (!ctx.isAuthed || !ctx.user) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  if (!isAdminOrMod(ctx.user)) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const days = Math.min(Number(url.searchParams.get("days") ?? "14"), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Events to track in funnel
  const events = [
    "LOCKED_IMPRESSION",
    "UNLOCK_CLICK",
    "UNLOCK_NO_CREDIT_ACCOUNT",
    "UNLOCK_INSUFFICIENT_CREDITS",
    "UNLOCK_SUCCESS",
    "UNLOCK_ALREADY",
    "WATCH_AFTER_UNLOCK",
    "BULK_UNLOCK_ATTEMPT",
    "BULK_UNLOCK_RESULT",
  ] as const;

  const rows = await Promise.all(
    events.map(async (event) => ({
      event,
      count: await db.unlockAnalyticsEvent.count({
        where: { event, createdAt: { gte: since } },
      }),
    }))
  );

  // Revenue summary: credits spent and avg cost
  const agg = await db.videoUnlock.aggregate({
    where: { createdAt: { gte: since } },
    _sum: { cost: true },
    _avg: { cost: true },
    _count: { _all: true },
  });

  return NextResponse.json({
    ok: true,
    since,
    days,
    rows,
    unlocks: agg._count._all,
    creditsSpent: agg._sum.cost ?? 0,
    avgCost: agg._avg.cost ?? 0,
  });
}
