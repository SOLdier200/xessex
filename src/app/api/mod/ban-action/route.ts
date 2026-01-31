/**
 * POST /api/mod/ban-action
 * Perform ban/unban actions on users for comments, votes, or ratings
 * Body: {
 *   userId: string,
 *   action: "ban" | "unban",
 *   targetType: "comment" | "vote" | "rating",
 *   duration?: "1_week" | "2_week" | "4_week" | "permanent" (required for ban)
 *   reason?: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TWO_WEEK_MS = 14 * 24 * 60 * 60 * 1000;
const FOUR_WEEK_MS = 28 * 24 * 60 * 60 * 1000;

type BanStatus = "ALLOWED" | "WARNED" | "TEMP_BANNED" | "PERM_BANNED" | "UNBANNED";

function getDurationMs(duration: string): number | null {
  switch (duration) {
    case "1_week":
      return ONE_WEEK_MS;
    case "2_week":
      return TWO_WEEK_MS;
    case "4_week":
      return FOUR_WEEK_MS;
    case "permanent":
      return null;
    default:
      return ONE_WEEK_MS;
  }
}

function getDurationLabel(duration: string): string {
  switch (duration) {
    case "1_week":
      return "1 week";
    case "2_week":
      return "2 weeks";
    case "4_week":
      return "4 weeks";
    case "permanent":
      return "permanently";
    default:
      return duration;
  }
}

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

  const { userId, action, targetType, duration, reason } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ ok: false, error: "MISSING_USER_ID" }, { status: 400 });
  }

  if (!action || !["ban", "unban"].includes(action)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ACTION", message: "Action must be 'ban' or 'unban'" },
      { status: 400 }
    );
  }

  if (!targetType || !["comment", "vote", "rating"].includes(targetType)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_TARGET_TYPE", message: "Target type must be 'comment', 'vote', or 'rating'" },
      { status: 400 }
    );
  }

  if (action === "ban" && !duration) {
    return NextResponse.json(
      { ok: false, error: "MISSING_DURATION", message: "Duration is required for ban action" },
      { status: 400 }
    );
  }

  if (action === "ban" && !["1_week", "2_week", "4_week", "permanent"].includes(duration)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_DURATION", message: "Duration must be '1_week', '2_week', '4_week', or 'permanent'" },
      { status: 400 }
    );
  }

  // Verify target user exists
  const targetUser = await db.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  try {
    const now = new Date();
    const durationMs = action === "ban" ? getDurationMs(duration) : null;
    const expiresAt = durationMs ? new Date(now.getTime() + durationMs) : null;
    const isPermanent = action === "ban" && duration === "permanent";

    // Determine the field names based on target type
    const statusField = `${targetType}BanStatus` as const;
    const untilField = `${targetType}BanUntil` as const;
    const reasonField = `${targetType}BanReason` as const;

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (action === "ban") {
      updateData[statusField] = isPermanent ? "PERM_BANNED" : "TEMP_BANNED";
      updateData[untilField] = expiresAt;
      updateData[reasonField] = reason || `Suspended by moderator for ${getDurationLabel(duration)}`;
    } else {
      // Unban
      updateData[statusField] = "UNBANNED";
      updateData[untilField] = null;
      // Keep the reason for history
    }

    // Update user and log the action in a transaction
    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: updateData,
      }),
      db.modAction.create({
        data: {
          modId: modUser.id,
          targetUserId: userId,
          actionType: action === "ban"
            ? `${targetType.toUpperCase()}_BAN`
            : `${targetType.toUpperCase()}_UNBAN`,
          actionSubtype: action === "ban" ? duration : null,
          reason: reason || null,
          details: JSON.stringify({
            targetType,
            duration: action === "ban" ? duration : null,
            expiresAt: expiresAt?.toISOString() || null,
          }),
        },
      }),
      // If banning comments and we have the CommentBan table, also record there
      ...(targetType === "comment" && action === "ban"
        ? [
            db.commentBan.create({
              data: {
                userId,
                banType: isPermanent ? "permanent" : `temp_${duration}`,
                reason: reason || `Suspended by moderator for ${getDurationLabel(duration)}`,
                expiresAt,
              },
            }),
          ]
        : []),
    ]);

    const actionLabel = action === "ban"
      ? `${targetType} banned ${getDurationLabel(duration)}`
      : `${targetType} unbanned`;

    console.log(`[mod/ban-action] ${modUser.id} performed ${actionLabel} on user ${userId}`);

    return NextResponse.json({
      ok: true,
      action,
      targetType,
      duration: action === "ban" ? duration : null,
      userId,
      expiresAt: expiresAt?.toISOString() || null,
    });
  } catch (err) {
    console.error("[mod/ban-action] Error:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
