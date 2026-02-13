import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { getVideoAccessForContext } from "@/lib/videoAccess";

export const runtime = "nodejs";

/**
 * GET /api/videos/[id]/access
 *
 * Check if the current user has access to a video.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: videoId } = await params;
  const ctx = await getAccessContext();

  const access = await getVideoAccessForContext({
    videoId,
    userId: ctx.user?.id ?? null,
    isAdminOrMod: ctx.isAdminOrMod,
    creditBalance: ctx.creditBalance,
  });

  if (!access.ok) {
    const status = access.error === "not_found" ? 404 : 401;
    return NextResponse.json({ ok: false, error: access.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    unlocked: access.unlocked,
    reason: access.reason,
    unlockCost: access.unlockCost,
    creditBalance: access.unlocked ? ctx.creditBalance : (access as { creditBalance: number }).creditBalance,
    canUnlock: access.unlocked || ctx.creditBalance >= access.unlockCost,
    isAuthed: ctx.isAuthed,
    hasWallet: ctx.hasWallet,
  });
}
