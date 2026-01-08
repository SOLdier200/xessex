import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

const ONE_MIN = 60_000;

/**
 * POST /api/mod/comments/vote
 * Admin/Mod hidden vote on comments (not displayed publicly)
 * Rules: flip ≤5
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (!access.isAdminOrMod) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    commentId?: string;
    value?: number;
  } | null;

  const commentId = body?.commentId?.trim();
  const value = body?.value;

  if (!commentId || (value !== 1 && value !== -1)) {
    return NextResponse.json(
      { ok: false, error: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.status !== "ACTIVE") {
    return NextResponse.json(
      { ok: false, error: "COMMENT_NOT_FOUND" },
      { status: 404 }
    );
  }

  const existing = await db.commentModVote.findUnique({
    where: {
      commentId_modId: { commentId, modId: access.user.id },
    },
  });

  const now = Date.now();

  if (!existing) {
    // Create new vote
    const created = await db.commentModVote.create({
      data: {
        commentId,
        modId: access.user.id,
        value,
        flipCount: 0,
        lastChangedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, vote: created });
  }

  // Same vote - no-op
  if (existing.value === value) {
    return NextResponse.json({ ok: true, vote: existing });
  }

  // Optional rate limit for hygiene
  if (now - existing.lastChangedAt.getTime() < ONE_MIN) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMIT_1_PER_MINUTE" },
      { status: 429 }
    );
  }

  // Flip limit: ≤5
  if (existing.flipCount >= 5) {
    return NextResponse.json(
      { ok: false, error: "FLIP_LIMIT_REACHED" },
      { status: 403 }
    );
  }

  // Update vote (flip)
  const updated = await db.commentModVote.update({
    where: { id: existing.id },
    data: {
      value,
      flipCount: { increment: 1 },
      lastChangedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, vote: updated });
}
