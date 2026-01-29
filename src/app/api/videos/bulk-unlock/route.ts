import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { bulkUnlockVideosTx } from "@/lib/bulkUnlockVideosTx";
import { getUnlockCostForNext } from "@/lib/unlockPricing";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/videos/bulk-unlock
 *
 * Unlock multiple videos (up to 5) in a single transaction.
 * Uses progressive pricing ladder - each unlock costs more.
 * Stops when credits run out (partial success possible).
 *
 * Accepts either Prisma Video.id (cuid) OR Video.slug/viewkey.
 */
export async function POST(req: NextRequest) {
  const ctx = await getAccessContext();

  if (!ctx.isAuthed || !ctx.user) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  // Accept either videoKeys (new) or videoIds (legacy) for backwards compatibility
  const videoKeys = (body?.videoKeys as string[]) ?? (body?.videoIds as string[]) ?? [];

  if (!Array.isArray(videoKeys) || videoKeys.length === 0) {
    return NextResponse.json(
      { ok: false, error: "missing_videoKeys" },
      { status: 400 }
    );
  }

  if (videoKeys.length > 5) {
    return NextResponse.json(
      { ok: false, error: "too_many", max: 5 },
      { status: 400 }
    );
  }

  // Log analytics: bulk attempt
  await db.unlockAnalyticsEvent.create({
    data: {
      userId: ctx.user.id,
      event: "BULK_UNLOCK_ATTEMPT",
      meta: { count: videoKeys.length },
    },
  }).catch(() => {});

  const res = await bulkUnlockVideosTx({ userId: ctx.user.id, videoKeys });

  if (!res.ok) {
    // Log analytics: fail
    await db.unlockAnalyticsEvent.create({
      data: {
        userId: ctx.user.id,
        event: "BULK_UNLOCK_FAIL",
        meta: { error: res.error },
      },
    }).catch(() => {});

    const status = res.error === "no_credit_account" ? 402 : 400;
    return NextResponse.json({ ok: false, error: res.error }, { status });
  }

  // Log analytics: result
  await db.unlockAnalyticsEvent.create({
    data: {
      userId: ctx.user.id,
      event: "BULK_UNLOCK_RESULT",
      meta: {
        totalCost: res.totalCost,
        items: res.items,
      },
    },
  }).catch(() => {});

  // Calculate next unlock cost
  const nextCost = getUnlockCostForNext(res.unlockedCount);

  return NextResponse.json({
    ok: true,
    items: res.items,
    totalCost: res.totalCost,
    newCredits: res.newCredits,
    unlockedCount: res.unlockedCount,
    nextCost,
  });
}
