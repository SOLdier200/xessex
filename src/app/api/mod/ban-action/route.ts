/**
 * POST /api/mod/ban-action
 * Perform ban/unban actions on users for comments, votes, ratings, or rewards
 * Body: {
 *   userId: string,
 *   action: "ban" | "unban",
 *   targetType: "comment" | "vote" | "rating" | "reward",
 *   duration?: "permanent" | string (legacy preset),
 *   weeks?: number (custom week count — takes priority over duration),
 *   reason?: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";
import { notifyMods, getUserDisplayString } from "@/lib/modNotifications";

export const runtime = "nodejs";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function resolveDuration(body: { duration?: string; weeks?: number }): { ms: number | null; label: string; isPermanent: boolean } {
  // Custom weeks takes priority
  if (typeof body.weeks === "number" && body.weeks > 0) {
    return {
      ms: body.weeks * ONE_WEEK_MS,
      label: `${body.weeks} week${body.weeks === 1 ? "" : "s"}`,
      isPermanent: false,
    };
  }

  // Permanent
  if (body.duration === "permanent" || body.weeks === 0) {
    return { ms: null, label: "permanently", isPermanent: true };
  }

  // Legacy presets
  switch (body.duration) {
    case "1_week": return { ms: ONE_WEEK_MS, label: "1 week", isPermanent: false };
    case "2_week": return { ms: 2 * ONE_WEEK_MS, label: "2 weeks", isPermanent: false };
    case "3_week": return { ms: 3 * ONE_WEEK_MS, label: "3 weeks", isPermanent: false };
    case "4_week": return { ms: 4 * ONE_WEEK_MS, label: "4 weeks", isPermanent: false };
    default: return { ms: ONE_WEEK_MS, label: "1 week", isPermanent: false };
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

  const { userId, action, targetType, reason } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ ok: false, error: "MISSING_USER_ID" }, { status: 400 });
  }

  if (!action || !["ban", "unban"].includes(action)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ACTION", message: "Action must be 'ban' or 'unban'" },
      { status: 400 }
    );
  }

  if (!targetType || !["comment", "vote", "rating", "reward"].includes(targetType)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_TARGET_TYPE", message: "Target type must be 'comment', 'vote', 'rating', or 'reward'" },
      { status: 400 }
    );
  }

  if (action === "ban" && !body.duration && typeof body.weeks !== "number") {
    return NextResponse.json(
      { ok: false, error: "MISSING_DURATION", message: "Duration or weeks is required for ban action" },
      { status: 400 }
    );
  }

  // Verify target user exists
  const targetUser = await db.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  try {
    const { ms: durationMs, label: durationLabel, isPermanent } = resolveDuration(body);
    const now = new Date();
    const expiresAt = durationMs ? new Date(now.getTime() + durationMs) : null;

    // Determine the field names based on target type
    const statusField = `${targetType}BanStatus` as const;
    const untilField = `${targetType}BanUntil` as const;
    const reasonField = `${targetType}BanReason` as const;

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (action === "ban") {
      updateData[statusField] = isPermanent ? "PERM_BANNED" : "TEMP_BANNED";
      updateData[untilField] = expiresAt;
      updateData[reasonField] = reason || `Suspended by moderator for ${durationLabel}`;
    } else {
      // Unban
      updateData[statusField] = "UNBANNED";
      updateData[untilField] = null;
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
          actionSubtype: action === "ban" ? (body.weeks ? `${body.weeks}_week` : body.duration) : null,
          reason: reason || null,
          details: JSON.stringify({
            targetType,
            weeks: body.weeks ?? null,
            duration: action === "ban" ? durationLabel : null,
            expiresAt: expiresAt?.toISOString() || null,
          }),
        },
      }),
      // If banning comments, also record in CommentBan table
      ...(targetType === "comment" && action === "ban"
        ? [
            db.commentBan.create({
              data: {
                userId,
                banType: isPermanent ? "permanent" : `temp_${body.weeks ? body.weeks + "_week" : body.duration}`,
                reason: reason || `Suspended by moderator for ${durationLabel}`,
                expiresAt,
              },
            }),
          ]
        : []),
    ]);

    // Send user notification for reward bans
    if (targetType === "reward") {
      db.userMessage.create({
        data: {
          userId,
          type: "WARNING",
          subject: action === "ban" ? "XESS Reward Hold Applied" : "XESS Rewards Restored",
          body: action === "ban"
            ? `Your XESS token payouts have been placed on hold ${isPermanent ? "permanently" : `for ${durationLabel}`}.${reason ? ` Reason: ${reason}` : ""} Contact support if you believe this is an error.`
            : `Your XESS token payouts have been restored. You will resume earning rewards in the next payout cycle.`,
        },
      }).catch((e: unknown) => console.error("[ban-action] Failed to send user notification:", e));
    }

    const actionLabel = action === "ban"
      ? `${targetType} banned ${durationLabel}`
      : `${targetType} unbanned`;

    console.log(`[mod/ban-action] ${modUser.id} performed ${actionLabel} on user ${userId}`);

    // Notify other mods about the action
    notifyMods({
      type: action === "ban" ? "USER_BANNED" : "USER_UNBANNED",
      targetUserId: userId,
      targetUserDisplay: getUserDisplayString(targetUser),
      details: `${targetType.charAt(0).toUpperCase() + targetType.slice(1)} ${action === "ban" ? "suspended" : "restored"} by ${modUser.email || modUser.id.slice(0, 8)}${action === "ban" ? ` for ${durationLabel}` : ""}.${reason ? `\nReason: ${reason}` : ""}`,
    });

    return NextResponse.json({
      ok: true,
      action,
      targetType,
      duration: action === "ban" ? durationLabel : null,
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
