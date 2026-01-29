import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

/**
 * POST /api/analytics/unlock
 *
 * Log client-side unlock analytics events (impressions, clicks, etc.)
 */
export async function POST(req: NextRequest) {
  const ctx = await getAccessContext();
  const body = await req.json().catch(() => null);

  const event = body?.event as string | undefined;
  if (!event) {
    return NextResponse.json({ ok: false, error: "missing_event" }, { status: 400 });
  }

  await db.unlockAnalyticsEvent.create({
    data: {
      userId: ctx.isAuthed ? ctx.user?.id ?? null : null,
      sessionId: (body?.sessionId as string | undefined) ?? null,
      videoId: (body?.videoId as string | undefined) ?? null,
      event,
      meta: body?.meta ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
