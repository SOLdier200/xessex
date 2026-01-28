import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { unlockVideoTx } from "@/lib/unlockVideoTx";

export const runtime = "nodejs";

/**
 * POST /api/videos/[id]/unlock
 *
 * Spend Special Credits to unlock a video.
 * Returns the new credit balance and cost on success.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: videoId } = await params;

  const ctx = await getAccessContext();

  if (!ctx.isAuthed || !ctx.user) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  const res = await unlockVideoTx({ userId: ctx.user.id, videoId });

  if (!res.ok) {
    const status =
      res.error === "not_found" ? 404 :
      res.error === "already_unlocked" ? 409 :
      res.error === "insufficient_credits" ? 402 :
      res.error === "no_credit_account" ? 402 :
      400;

    return NextResponse.json({ ok: false, error: res.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    unlocked: true,
    cost: res.cost,
    creditBalance: res.newCredits,
  });
}
