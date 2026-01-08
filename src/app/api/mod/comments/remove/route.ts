import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

/**
 * POST /api/mod/comments/remove
 * Admin/Mod remove comment (sets status=REMOVED, never hard delete)
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
    reason?: string;
  } | null;

  const commentId = body?.commentId?.trim();
  const reason = body?.reason?.trim() || "removed";

  if (!commentId) {
    return NextResponse.json(
      { ok: false, error: "MISSING_COMMENT_ID" },
      { status: 400 }
    );
  }

  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 }
    );
  }

  // Set status to REMOVED (never hard delete)
  const updated = await db.comment.update({
    where: { id: commentId },
    data: {
      status: "REMOVED",
      removedById: access.user.id,
      removedAt: new Date(),
      removedReason: reason,
    },
  });

  return NextResponse.json({ ok: true, comment: updated });
}
