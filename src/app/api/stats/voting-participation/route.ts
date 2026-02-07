/**
 * Voting Participation API
 *
 * Returns user's voting participation percentage based on engagement scope:
 * - votesCast: Number of active comments user has voted on (member + mod votes)
 * - totalComments: Active comments on videos the user has unlocked OR voted on
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

    // Get votes (member + mod) on ACTIVE comments and their video IDs
    const [memberVotes, modVotes] = await Promise.all([
      db.commentMemberVote.findMany({
        where: { voterId: user.id, comment: { status: "ACTIVE" } },
        select: { commentId: true, comment: { select: { videoId: true } } },
      }),
      db.commentModVote.findMany({
        where: { modId: user.id, comment: { status: "ACTIVE" } },
        select: { commentId: true, comment: { select: { videoId: true } } },
      }),
    ]);

    const videoIdSet = new Set<string>(unlockedVideoIds);
    const votedCommentIds = new Set<string>();

    for (const vote of memberVotes) {
      votedCommentIds.add(vote.commentId);
      if (vote.comment?.videoId) videoIdSet.add(vote.comment.videoId);
    }
    for (const vote of modVotes) {
      votedCommentIds.add(vote.commentId);
      if (vote.comment?.videoId) videoIdSet.add(vote.comment.videoId);
    }

    if (videoIdSet.size === 0) {
      return NextResponse.json({
        ok: true,
        votesCast: 0,
        totalComments: 0,
        percentage: 0,
      });
    }

    // Count active comments in the engagement scope (unlocked or voted videos)
    const totalComments = await db.comment.count({
      where: {
        status: "ACTIVE",
        videoId: { in: Array.from(videoIdSet) },
      },
    });

    // Count distinct votes on active comments (member + mod)
    const votesCast = votedCommentIds.size;

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
