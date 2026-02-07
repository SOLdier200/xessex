/**
 * POST /api/mod/users/revoke-1star-ratings
 * Revoke all 1-star ratings from a user (for star abuse)
 * Body: { userId: string, reason?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";
import { recomputeVideoRanks } from "@/lib/videoRank";
import { notifyMods, getUserDisplayString } from "@/lib/modNotifications";

export const runtime = "nodejs";

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

  const { userId, reason } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ ok: false, error: "MISSING_USER_ID" }, { status: 400 });
  }

  // Verify target user exists
  const targetUser = await db.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  try {
    // Find all 1-star ratings by this user
    const oneStarRatings = await db.videoStarRating.findMany({
      where: {
        userId,
        stars: 1,
      },
      select: {
        id: true,
        videoId: true,
      },
    });

    if (oneStarRatings.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No 1-star ratings found for this user",
        deletedCount: 0,
      });
    }

    // Get unique video IDs that will need rank recomputation
    const affectedVideoIds = [...new Set(oneStarRatings.map((r) => r.videoId))];

    // Delete all 1-star ratings and log the action in a transaction
    await db.$transaction([
      db.videoStarRating.deleteMany({
        where: {
          userId,
          stars: 1,
        },
      }),
      db.modAction.create({
        data: {
          modId: modUser.id,
          targetUserId: userId,
          actionType: "REVOKE_1STAR_RATINGS",
          reason: reason || "Star abuse - all 1-star ratings revoked",
          details: JSON.stringify({
            deletedCount: oneStarRatings.length,
            affectedVideoIds,
          }),
        },
      }),
    ]);

    // Recompute video ranks for affected videos
    await recomputeVideoRanks();

    console.log(
      `[mod/revoke-1star-ratings] ${modUser.id} revoked ${oneStarRatings.length} 1-star ratings from user ${userId}`
    );

    // Notify other mods about the action
    notifyMods({
      type: "USER_BANNED",
      targetUserId: userId,
      targetUserDisplay: getUserDisplayString(targetUser),
      details: `${oneStarRatings.length} 1-star rating(s) revoked by ${getUserDisplayString(modUser)} for star abuse.\nAffected ${affectedVideoIds.length} video(s).`,
    });

    return NextResponse.json({
      ok: true,
      deletedCount: oneStarRatings.length,
      affectedVideoIds,
      userId,
    });
  } catch (err) {
    console.error("[mod/revoke-1star-ratings] Error:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
