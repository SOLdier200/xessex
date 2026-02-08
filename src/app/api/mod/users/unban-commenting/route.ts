import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

/**
 * POST /api/mod/users/unban-commenting
 * Body: { userId: string }
 *
 * Clears comment ban fields and sets status to UNBANNED.
 * Safe: does NOT undo PERM_BANNED unless you explicitly want that behavior.
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { userId?: string } | null;
  const userId = body?.userId?.trim();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, commentBanStatus: true, commentBanUntil: true },
  });

  if (!target) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  // Don't undo perm bans (keeps this button safe)
  if (target.commentBanStatus === "PERM_BANNED") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      status: "PERM_BANNED",
      until: target.commentBanUntil ? target.commentBanUntil.toISOString() : null,
    });
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      commentBanStatus: "UNBANNED",
      commentBanUntil: null,
      commentBanReason: null,
    },
    select: { id: true, commentBanStatus: true, commentBanUntil: true, commentBanReason: true },
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      commentBanStatus: updated.commentBanStatus,
      commentBanUntil: updated.commentBanUntil ? updated.commentBanUntil.toISOString() : null,
      commentBanReason: updated.commentBanReason ?? null,
    },
  });
}
