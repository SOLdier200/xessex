/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

/**
 * POST /api/mod/comments/remove
 * Body: { commentId: string, reason?: string }
 *
 * Removes a comment (moderator action).
 * - Marks status REMOVED
 * - Populates removedById / removedAt / removedReason
 * - Resolves open reports (optional but recommended)
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (access.user.role !== "MOD" && access.user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { commentId?: string; reason?: string }
    | null;

  const commentId = body?.commentId?.trim();
  const reason =
    typeof body?.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 200)
      : "Removed by moderator";

  if (!commentId) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  const result = await db.$transaction(async (tx) => {
    const c = await tx.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        status: true,
        removedAt: true,
      },
    });

    if (!c) return { ok: false as const, error: "COMMENT_NOT_FOUND" as const };

    // Idempotent: if already removed, just return ok
    if (c.status === "REMOVED" || c.removedAt) {
      return { ok: true as const, alreadyRemoved: true };
    }

    await tx.comment.update({
      where: { id: commentId },
      data: {
        status: "REMOVED",
        removedAt: new Date(),
        removedById: access.user!.id,
        removedReason: reason,
      },
    });

    // Optional: resolve any outstanding reports
    await tx.commentReport.updateMany({
      where: { commentId, resolvedAt: null },
      data: { resolvedAt: new Date(), resolvedById: access.user!.id },
    });

    return { ok: true as const, alreadyRemoved: false };
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    alreadyRemoved: result.alreadyRemoved,
  });
}
