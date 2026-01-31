/**
 * GET /api/mod/unruly-users
 * Returns three categories of unruly users:
 * 1. Comment spammers: Users with 3+ removed comments (not yet banned)
 * 2. Dislike spammers: Users who dislike 75%+ of comments they vote on
 * 3. Star abusers: Users who gave 10+ videos a 1-star rating
 */

import { NextResponse } from "next/server";
import { requireAdminOrMod } from "@/lib/adminActions";
import { getUnrulyUsers } from "@/lib/commentModeration";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Get comment spammers (3+ removed comments, not yet banned)
  const commentSpammers = await getUnrulyUsers();

  // Get dislike spammers (75%+ dislikes out of total votes)
  // First, get vote statistics for all users
  const voteStats = await db.commentMemberVote.groupBy({
    by: ["voterId"],
    _count: { id: true },
    _sum: { value: true }, // value is 1 (like) or -1 (dislike)
  });

  // Calculate dislike percentage for each voter
  const dislikeSpammerIds: string[] = [];
  const dislikeRatios: Map<string, { totalVotes: number; dislikes: number; ratio: number }> = new Map();

  for (const stat of voteStats) {
    const totalVotes = stat._count.id;
    if (totalVotes < 10) continue; // Minimum 10 votes to be considered

    // Sum of values: likes (+1) + dislikes (-1)
    // If total is 10 and sum is -6, that means 2 likes + 8 dislikes = -6
    // dislikes = (total - sum) / 2
    const sum = stat._sum.value ?? 0;
    const dislikes = (totalVotes - sum) / 2;
    const ratio = dislikes / totalVotes;

    if (ratio >= 0.75) {
      dislikeSpammerIds.push(stat.voterId);
      dislikeRatios.set(stat.voterId, { totalVotes, dislikes, ratio });
    }
  }

  // Get user details for dislike spammers
  const dislikeSpammerUsers = dislikeSpammerIds.length > 0
    ? await db.user.findMany({
        where: { id: { in: dislikeSpammerIds } },
        select: {
          id: true,
          email: true,
          walletAddress: true,
          commentBanStatus: true,
          createdAt: true,
        },
      })
    : [];

  const dislikeSpammers = dislikeSpammerUsers.map((u) => {
    const stats = dislikeRatios.get(u.id)!;
    return {
      id: u.id,
      email: u.email,
      wallet: u.walletAddress,
      status: u.commentBanStatus,
      totalVotes: stats.totalVotes,
      dislikes: stats.dislikes,
      dislikeRatio: Math.round(stats.ratio * 100),
      createdAt: u.createdAt.toISOString(),
    };
  }).sort((a, b) => b.dislikeRatio - a.dislikeRatio);

  // ============ Star Abusers (10+ 1-star ratings) ============
  const oneStarCounts = await db.videoStarRating.groupBy({
    by: ["userId"],
    where: { stars: 1 },
    _count: { id: true },
    having: { id: { _count: { gte: 10 } } },
  });

  const starAbuserIds = oneStarCounts.map((c) => c.userId);

  const starAbuserUsers = starAbuserIds.length > 0
    ? await db.user.findMany({
        where: { id: { in: starAbuserIds } },
        select: {
          id: true,
          email: true,
          walletAddress: true,
          ratingBanStatus: true,
          createdAt: true,
          starAbuseWarnings: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      })
    : [];

  const starCountMap = new Map(oneStarCounts.map((c) => [c.userId, c._count.id]));

  const starAbusers = starAbuserUsers.map((u) => ({
    id: u.id,
    email: u.email,
    wallet: u.walletAddress,
    status: u.ratingBanStatus,
    oneStarCount: starCountMap.get(u.id) || 0,
    lastWarning: u.starAbuseWarnings[0]
      ? {
          createdAt: u.starAbuseWarnings[0].createdAt.toISOString(),
          acknowledged: !!u.starAbuseWarnings[0].acknowledgedAt,
        }
      : null,
    createdAt: u.createdAt.toISOString(),
  })).sort((a, b) => b.oneStarCount - a.oneStarCount);

  return NextResponse.json({
    ok: true,
    commentSpammers: commentSpammers.map((u) => ({
      id: u.id,
      email: u.email,
      wallet: u.walletAddress,
      status: u.commentBanStatus,
      removedCount: u.removedCommentCount,
      lastWarning: u.lastWarning
        ? {
            type: u.lastWarning.warningType,
            createdAt: u.lastWarning.createdAt.toISOString(),
            acknowledged: !!u.lastWarning.acknowledgedAt,
          }
        : null,
      createdAt: u.createdAt.toISOString(),
    })),
    dislikeSpammers,
    starAbusers,
  });
}
