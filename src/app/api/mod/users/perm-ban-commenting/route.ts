import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

/**
 * POST /api/mod/users/perm-ban-commenting
 * Body: { userId: string, reason?: string }
 *
 * Permanently bans a user from commenting.
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { userId?: string; reason?: string }
    | null;

  const userId = body?.userId?.trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  const reason =
    typeof body?.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 200)
      : "Permanent ban by moderator";

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, commentBanStatus: true },
  });

  if (!target) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  // Idempotent: if already perm banned, just return ok
  if (target.commentBanStatus === "PERM_BANNED") {
    return NextResponse.json({ ok: true, already: true, status: "PERM_BANNED" });
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      commentBanStatus: "PERM_BANNED",
      commentBanUntil: null,
      commentBanReason: reason,
    },
    select: { id: true, commentBanStatus: true, commentBanUntil: true, commentBanReason: true },
  });

  return NextResponse.json({
    ok: true,
    already: false,
    user: {
      id: updated.id,
      commentBanStatus: updated.commentBanStatus,
      commentBanUntil: updated.commentBanUntil ? updated.commentBanUntil.toISOString() : null,
      commentBanReason: updated.commentBanReason ?? null,
    },
  });
}
