/**
 * POST /api/mod/claim-freeze
 * Freeze or unfreeze a user's claim button.
 * Body: {
 *   userId: string,
 *   action: "freeze" | "unfreeze",
 *   weeks?: number  (omit or 0 for indefinite freeze)
 *   reason?: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";
import { notifyMods, getUserDisplayString } from "@/lib/modNotifications";

export const runtime = "nodejs";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const modUser = await requireAdminOrMod();
  if (!modUser) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const { userId, action, weeks, reason } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ ok: false, error: "MISSING_USER_ID" }, { status: 400 });
  }

  if (!action || !["freeze", "unfreeze"].includes(action)) {
    return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
  }

  const targetUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, walletAddress: true },
  });
  if (!targetUser) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const freezeUntil = action === "freeze" && typeof weeks === "number" && weeks > 0
    ? new Date(Date.now() + weeks * ONE_WEEK_MS)
    : null;

  const durationLabel = action === "unfreeze"
    ? "lifted"
    : freezeUntil
      ? `${weeks} week${weeks === 1 ? "" : "s"}`
      : "indefinitely";

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: action === "freeze"
        ? {
            claimFrozen: true,
            claimFrozenUntil: freezeUntil,
            claimFrozenReason: reason || `Claim frozen ${durationLabel} by moderator`,
          }
        : {
            claimFrozen: false,
            claimFrozenUntil: null,
            claimFrozenReason: null,
          },
    }),
    db.modAction.create({
      data: {
        modId: modUser.id,
        targetUserId: userId,
        actionType: action === "freeze" ? "CLAIM_FREEZE" : "CLAIM_UNFREEZE",
        actionSubtype: action === "freeze" ? (freezeUntil ? `${weeks}_week` : "indefinite") : null,
        reason: reason || null,
        details: JSON.stringify({
          weeks: weeks ?? null,
          freezeUntil: freezeUntil?.toISOString() || null,
        }),
      },
    }),
    db.userMessage.create({
      data: {
        userId,
        type: "WARNING",
        subject: action === "freeze" ? "Claim Button Frozen" : "Claim Button Restored",
        body: action === "freeze"
          ? `Your ability to claim XESS tokens has been frozen ${durationLabel}.${reason ? ` Reason: ${reason}` : ""}`
          : "Your ability to claim XESS tokens has been restored.",
      },
    }),
  ]);

  notifyMods({
    type: "CLAIM_FREEZE",
    targetUserId: userId,
    targetUserDisplay: getUserDisplayString(targetUser),
    details: `Claim ${action === "freeze" ? `frozen ${durationLabel}` : "unfrozen"} by ${modUser.email || modUser.id.slice(0, 8)}.${reason ? `\nReason: ${reason}` : ""}`,
  });

  return NextResponse.json({
    ok: true,
    action,
    userId,
    freezeUntil: freezeUntil?.toISOString() || null,
  });
}
