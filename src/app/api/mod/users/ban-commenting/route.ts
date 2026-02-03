import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

function isAdminOrMod(role: string) {
  return role === "ADMIN" || role === "MOD";
}

/**
 * POST /api/mod/users/ban-commenting
 * Body: { userId: string, hours?: number, reason?: string }
 *
 * Sets TEMP_BANNED for N hours (default 24).
 * Idempotent-ish: reapplying will extend/overwrite banUntil.
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isAdminOrMod(access.user.role)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { userId?: string; hours?: number; reason?: string }
    | null;

  const userId = body?.userId?.trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  const hoursRaw = typeof body?.hours === "number" ? body.hours : 24;
  const hours = Math.max(1, Math.min(168, Math.floor(hoursRaw))); // clamp 1h..7d

  const reason =
    typeof body?.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 200)
      : `Temp ban (${hours}h) by moderator`;

  const until = new Date(Date.now() + hours * 60 * 60 * 1000);

  // Don't downgrade a perm ban
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, commentBanStatus: true, commentBanUntil: true },
  });

  if (!target) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

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
      commentBanStatus: "TEMP_BANNED",
      commentBanUntil: until,
      commentBanReason: reason,
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
