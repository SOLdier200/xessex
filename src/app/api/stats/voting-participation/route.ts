/**
 * Voting Participation API
 *
 * Returns user's voting participation percentage based on unlocked videos:
 * - votesCast: Number of comments user has voted on (on their unlocked videos)
 * - totalComments: Active comments on videos the user has unlocked
 * - percentage: (votesCast / totalComments) * 100
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    // Get video IDs the user has unlocked
    const unlocks = await db.videoUnlock.findMany({
      where: { userId: user.id },
      select: { videoId: true },
    });

    const unlockedVideoIds = unlocks.map((u) => u.videoId);

    if (unlockedVideoIds.length === 0) {
      return NextResponse.json({
        ok: true,
        votesCast: 0,
        totalComments: 0,
        percentage: 0,
      });
    }

    // Count active comments on unlocked videos
    const totalComments = await db.comment.count({
      where: {
        status: "ACTIVE",
        videoId: { in: unlockedVideoIds },
      },
    });

    // Count user's votes on comments from unlocked videos
    const votesCast = await db.commentMemberVote.count({
      where: {
        voterId: user.id,
        comment: {
          videoId: { in: unlockedVideoIds },
        },
      },
    });

    // Calculate percentage (handle division by zero)
    const percentage = totalComments > 0
      ? Math.round((votesCast / totalComments) * 10000) / 100
      : 0;

    return NextResponse.json({
      ok: true,
      votesCast,
      totalComments,
      percentage,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[voting-participation] Error:", message);
    return NextResponse.json(
      { ok: false, error: "server_error", message },
      { status: 500 }
    );
  }
}
