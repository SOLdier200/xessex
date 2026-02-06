/**
 * GET /api/mod/user-activity?userId=...
 * Returns detailed user activity for moderation review:
 * - All comments (with status)
 * - All votes (likes/dislikes)
 * - All star ratings
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const modUser = await requireAdminOrMod();
  if (!modUser) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ ok: false, error: "MISSING_USER_ID" }, { status: 400 });
  }

  // Get user basic info
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      walletAddress: true,
      role: true,
      commentBanStatus: true,
      commentBanUntil: true,
      commentBanReason: true,
      voteBanStatus: true,
      voteBanUntil: true,
      voteBanReason: true,
      ratingBanStatus: true,
      ratingBanUntil: true,
      ratingBanReason: true,
      rewardBanStatus: true,
      rewardBanUntil: true,
      rewardBanReason: true,
      claimFrozen: true,
      claimFrozenUntil: true,
      claimFrozenReason: true,
      globalBanStatus: true,
      globalBanReason: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  // Get all comments by this user
  const comments = await db.comment.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      videoId: true,
      body: true,
      status: true,
      memberLikes: true,
      memberDislikes: true,
      score: true,
      createdAt: true,
      removedAt: true,
      removedReason: true,
    },
  });

  // Get all votes by this user
  const memberVotes = await db.commentMemberVote.findMany({
    where: { voterId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      commentId: true,
      value: true,
      createdAt: true,
      comment: {
        select: {
          body: true,
          videoId: true,
          author: { select: { email: true, walletAddress: true } },
        },
      },
    },
  });

  // Get all star ratings by this user
  const ratings = await db.videoStarRating.findMany({
    where: { userId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      videoId: true,
      stars: true,
      createdAt: true,
    },
  });

  // Calculate vote summary
  const totalVotes = memberVotes.length;
  const likes = memberVotes.filter((v) => v.value === 1).length;
  const dislikes = memberVotes.filter((v) => v.value === -1).length;
  const dislikeRatio = totalVotes > 0 ? Math.round((dislikes / totalVotes) * 100) : 0;

  // Calculate rating summary
  const totalRatings = ratings.length;
  const ratingBreakdown = {
    1: ratings.filter((r) => r.stars === 1).length,
    2: ratings.filter((r) => r.stars === 2).length,
    3: ratings.filter((r) => r.stars === 3).length,
    4: ratings.filter((r) => r.stars === 4).length,
    5: ratings.filter((r) => r.stars === 5).length,
  };
  const avgRating = totalRatings > 0
    ? ratings.reduce((sum, r) => sum + r.stars, 0) / totalRatings
    : 0;

  // Comment summary
  const totalComments = comments.length;
  const activeComments = comments.filter((c) => c.status === "ACTIVE").length;
  const removedComments = comments.filter((c) => c.status === "REMOVED").length;

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      wallet: user.walletAddress,
      role: user.role,
      // Comment ban info
      commentBanStatus: user.commentBanStatus,
      commentBanUntil: user.commentBanUntil?.toISOString() || null,
      commentBanReason: user.commentBanReason,
      // Vote ban info
      voteBanStatus: user.voteBanStatus,
      voteBanUntil: user.voteBanUntil?.toISOString() || null,
      voteBanReason: user.voteBanReason,
      // Rating ban info
      ratingBanStatus: user.ratingBanStatus,
      ratingBanUntil: user.ratingBanUntil?.toISOString() || null,
      ratingBanReason: user.ratingBanReason,
      // Reward ban info
      rewardBanStatus: user.rewardBanStatus,
      rewardBanUntil: user.rewardBanUntil?.toISOString() || null,
      rewardBanReason: user.rewardBanReason,
      // Claim freeze info
      claimFrozen: user.claimFrozen,
      claimFrozenUntil: user.claimFrozenUntil?.toISOString() || null,
      claimFrozenReason: user.claimFrozenReason,
      // Global ban info
      globalBanStatus: user.globalBanStatus,
      globalBanReason: user.globalBanReason,
      createdAt: user.createdAt.toISOString(),
    },
    summary: {
      comments: {
        total: totalComments,
        active: activeComments,
        removed: removedComments,
      },
      votes: {
        total: totalVotes,
        likes,
        dislikes,
        dislikeRatio,
      },
      ratings: {
        total: totalRatings,
        average: Math.round(avgRating * 10) / 10,
        breakdown: ratingBreakdown,
      },
    },
    comments: comments.map((c) => ({
      id: c.id,
      videoId: c.videoId,
      body: c.body,
      status: c.status,
      likes: c.memberLikes,
      dislikes: c.memberDislikes,
      score: c.score,
      createdAt: c.createdAt.toISOString(),
      removedAt: c.removedAt?.toISOString() || null,
      removedReason: c.removedReason,
    })),
    votes: memberVotes.map((v) => ({
      id: v.id,
      commentId: v.commentId,
      value: v.value,
      createdAt: v.createdAt.toISOString(),
      commentPreview: v.comment.body.slice(0, 100),
      commentAuthor: v.comment.author.email || v.comment.author.walletAddress?.slice(0, 8),
      videoId: v.comment.videoId,
    })),
    ratings: ratings.map((r) => ({
      id: r.id,
      videoId: r.videoId,
      score: r.stars,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
