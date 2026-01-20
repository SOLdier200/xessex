import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

/**
 * GET /api/analytics
 * Diamond analytics page data (exact fields from spec)
 */
export async function GET() {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json(
      { error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (access.tier !== "diamond") {
    return NextResponse.json(
      { error: "DIAMOND_ONLY" },
      { status: 403 }
    );
  }

  const userId = access.user.id;

  // Total videos in system
  const totalVideos = await db.video.count();

  // Get all comments by this Diamond user
  const comments = await db.comment.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      memberVotes: true,
      modVotes: true,
    },
  });

  // Get all score adjustments that used this user's comments
  const adjustments = await db.videoScoreAdjustment.findMany({
    where: {
      comment: { authorId: userId },
    },
    select: { commentId: true },
  });

  const utilizedSet = new Set(adjustments.map((a) => a.commentId));

  let totalMemberLikes = 0;
  let totalMemberDislikes = 0;
  let totalModLikes = 0;
  let totalModDislikes = 0;

  const commentRows = comments.map((c) => {
    const memberLikes = c.memberVotes.filter((v) => v.value === 1).length;
    const memberDislikes = c.memberVotes.filter((v) => v.value === -1).length;
    const modLikes = c.modVotes.filter((v) => v.value === 1).length;
    const modDislikes = c.modVotes.filter((v) => v.value === -1).length;

    totalMemberLikes += memberLikes;
    totalMemberDislikes += memberDislikes;
    totalModLikes += modLikes;
    totalModDislikes += modDislikes;

    return {
      sourceId: c.id,
      createdAt: c.createdAt.toISOString(),
      body: c.body.substring(0, 100) + (c.body.length > 100 ? "…" : ""),
      memberLikes,
      memberDislikes,
      modLikes,
      modDislikes,
      utilized: utilizedSet.has(c.id),
      score: c.score,
    };
  });

  // Query actual rewards from RewardEvent table (weekly rewards only)
  // PAID + claimedAt = actually claimed by user
  // PAID + claimedAt null = ready to claim (pending for user)
  const [claimedRewards, unclaimedRewards] = await Promise.all([
    db.rewardEvent.aggregate({
      where: { userId, status: "PAID", claimedAt: { not: null }, refType: { startsWith: "weekly" } },
      _sum: { amount: true },
    }),
    db.rewardEvent.aggregate({
      where: { userId, status: "PAID", claimedAt: null, refType: { startsWith: "weekly" } },
      _sum: { amount: true },
    }),
  ]);

  // Amounts are stored with 6 decimals - convert to whole XESS for display
  const DECIMALS = 1_000_000n;
  const totalXessPaid = Number((claimedRewards._sum.amount ?? 0n) / DECIMALS);
  const pendingXess = Number((unclaimedRewards._sum.amount ?? 0n) / DECIMALS);

  return NextResponse.json({
    ok: true,
    totals: {
      totalVideos,
      totalComments: comments.length,
      totalMemberLikes,
      totalMemberDislikes,
      totalModLikes,
      totalModDislikes,
      utilizedComments: utilizedSet.size,
      totalXessPaid,
      pendingXess,
    },
    comments: commentRows,
  });
}
