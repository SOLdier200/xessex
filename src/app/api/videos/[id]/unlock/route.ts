import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { unlockVideoTx } from "@/lib/unlockVideoTx";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/videos/[id]/unlock
 *
 * Spend Special Credits to unlock a video.
 * IDEMPOTENT: Returns success even if already unlocked (no charge, alreadyUnlocked: true).
 *
 * Accepts either Prisma Video.id (cuid) OR Video.slug/viewkey.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: videoKey } = await params;

  const ctx = await getAccessContext();

  if (!ctx.isAuthed || !ctx.user) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  const res = await unlockVideoTx({ userId: ctx.user.id, videoKey });

  if (!res.ok) {
    // Log analytics for failures
    await db.unlockAnalyticsEvent.create({
      data: {
        userId: ctx.user.id,
        videoId: videoKey,
        event: `UNLOCK_${res.error.toUpperCase()}`,
      },
    }).catch(() => {}); // Don't fail request if analytics fails

    const status =
      res.error === "not_found" ? 404 :
      res.error === "insufficient_credits" ? 402 :
      res.error === "no_credit_account" ? 402 :
      400;

    return NextResponse.json({ ok: false, error: res.error }, { status });
  }

  // Log analytics for success (use canonical videoId)
  await db.unlockAnalyticsEvent.create({
    data: {
      userId: ctx.user.id,
      videoId: res.videoId,
      event: res.alreadyUnlocked ? "UNLOCK_ALREADY" : "UNLOCK_SUCCESS",
      meta: { cost: res.cost },
    },
  }).catch(() => {}); // Don't fail request if analytics fails

  // nextCost is already computed by unlockVideoTx

  return NextResponse.json({
    ok: true,
    unlocked: true,
    alreadyUnlocked: res.alreadyUnlocked,
    cost: res.cost,
    creditBalance: res.newCredits,
    unlockedCount: res.unlockedCount,
    nextCost: res.nextCost,
    videoId: res.videoId,     // canonical Prisma id
    videoSlug: res.videoSlug, // canonical slug for client bookkeeping
  });
}
