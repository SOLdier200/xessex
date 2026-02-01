import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { weekKeyUTC } from "@/lib/weekKey";

// Genesis week start date (Monday)
const GENESIS_MONDAY = new Date("2026-01-13T00:00:00Z");

function getWeekIndex(weekKey: string): number {
  const weekStart = new Date(`${weekKey}T00:00:00Z`);
  const diffMs = weekStart.getTime() - GENESIS_MONDAY.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, diffWeeks);
}

// Emission schedule (6 decimals)
const EMISSION_DECIMALS = 6n;
const EMISSION_MULTIPLIER = 10n ** EMISSION_DECIMALS;

function getWeeklyEmission(weekIndex: number): bigint {
  if (weekIndex < 12) return 666_667n * EMISSION_MULTIPLIER;
  if (weekIndex < 39) return 500_000n * EMISSION_MULTIPLIER;
  if (weekIndex < 78) return 333_333n * EMISSION_MULTIPLIER;
  return 166_667n * EMISSION_MULTIPLIER;
}

// Pool splits
const LIKES_POOL_BPS = 7000n;    // 70%
const MVM_POOL_BPS = 2000n;      // 20%
const COMMENTS_POOL_BPS = 500n;  // 5%

// Ladder percentages for top 50
const LADDER_PERCENTS: number[] = [
  20, 12, 8,                          // Ranks 1-3
  5, 5, 5, 5, 5, 5, 5,                // Ranks 4-10
  ...Array(40).fill(0.625),           // Ranks 11-50
];

/**
 * GET /api/analytics
 * User analytics page data with live pending estimates
 * Available to all authenticated users
 */
export async function GET() {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json(
      { error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const userId = access.user.id;

  // Total videos in system
  const totalVideos = await db.video.count();

  // Get all comments by this user
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

  // Query actual rewards from RewardEvent table
  // PAID status = reward has been allocated/finalized
  // claimedAt not null = user has claimed on-chain
  const [allPaidRewards, claimedRewards] = await Promise.all([
    db.rewardEvent.aggregate({
      where: { userId, status: "PAID" },
      _sum: { amount: true },
    }),
    db.rewardEvent.aggregate({
      where: { userId, status: "PAID", claimedAt: { not: null } },
      _sum: { amount: true },
    }),
  ]);

  // Amounts are stored with 6 decimals - convert to whole XESS for display
  const DECIMALS = 1_000_000n;
  const totalXessPaid = Number((allPaidRewards._sum.amount ?? 0n) / DECIMALS);
  const claimedXess = Number((claimedRewards._sum.amount ?? 0n) / DECIMALS);
  const claimableXess = totalXessPaid - claimedXess;

  // ============================================
  // LIVE PENDING ESTIMATE (updates in real-time)
  // ============================================
  const now = new Date();
  const currentWeekKey = weekKeyUTC(now);
  const weekIndex = getWeekIndex(currentWeekKey);
  const emission = getWeeklyEmission(weekIndex);

  // Get current week stats for this user (aggregate across pools)
  const currentStats = await db.weeklyUserStat.findFirst({
    where: { weekKey: currentWeekKey, userId },
    orderBy: { scoreReceived: "desc" },
  });

  let estimatedPending6 = 0n;
  let userLikesRank: number | null = null;
  let userMvmRank: number | null = null;
  let userCommentsRank: number | null = null;

  if (currentStats) {
    // Get user's rank in likes pool (by scoreReceived)
    if (currentStats.scoreReceived > 0) {
      const likesRankResult = await db.weeklyUserStat.count({
        where: {
          weekKey: currentWeekKey,
          scoreReceived: { gt: currentStats.scoreReceived },
        },
      });
      userLikesRank = likesRankResult + 1; // 1-indexed rank

      // Calculate likes pool reward if in top 50
      if (userLikesRank <= 50) {
        const likesPool = (emission * LIKES_POOL_BPS) / 10000n;
        const percent = LADDER_PERCENTS[userLikesRank - 1] || 0;
        estimatedPending6 += (likesPool * BigInt(Math.round(percent * 100))) / 10000n;
      }
    }

    // Get user's rank in MVM pool (by mvmPoints)
    if (currentStats.mvmPoints > 0) {
      const mvmRankResult = await db.weeklyUserStat.count({
        where: {
          weekKey: currentWeekKey,
          mvmPoints: { gt: currentStats.mvmPoints },
        },
      });
      userMvmRank = mvmRankResult + 1;

      // Calculate MVM pool reward if in top 50
      if (userMvmRank <= 50) {
        const mvmPool = (emission * MVM_POOL_BPS) / 10000n;
        const percent = LADDER_PERCENTS[userMvmRank - 1] || 0;
        estimatedPending6 += (mvmPool * BigInt(Math.round(percent * 100))) / 10000n;
      }
    }

    // Get user's rank in comments pool (by diamondComments)
    if (currentStats.diamondComments > 0) {
      const commentsRankResult = await db.weeklyUserStat.count({
        where: {
          weekKey: currentWeekKey,
          diamondComments: { gt: currentStats.diamondComments },
        },
      });
      userCommentsRank = commentsRankResult + 1;

      // Calculate comments pool reward if in top 50
      if (userCommentsRank <= 50) {
        const commentsPool = (emission * COMMENTS_POOL_BPS) / 10000n;
        const percent = LADDER_PERCENTS[userCommentsRank - 1] || 0;
        estimatedPending6 += (commentsPool * BigInt(Math.round(percent * 100))) / 10000n;
      }
    }
  }

  const estimatedPendingXess = Number(estimatedPending6 / DECIMALS);

  // Calculate next payout time
  const nextMonday = new Date(`${currentWeekKey}T00:00:00Z`);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  const msUntilPayout = nextMonday.getTime() - now.getTime();
  const hoursUntil = Math.floor(msUntilPayout / (1000 * 60 * 60));
  const daysUntil = Math.floor(hoursUntil / 24);
  const remainingHours = hoursUntil % 24;

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
      claimableXess,        // From finalized RewardEvents (ready to claim)
      estimatedPendingXess, // Live estimate from current week activity
    },
    currentWeek: {
      weekKey: currentWeekKey,
      activity: {
        scoreReceived: currentStats?.scoreReceived ?? 0,
        diamondComments: currentStats?.diamondComments ?? 0,
        mvmPoints: currentStats?.mvmPoints ?? 0,
      },
      ranks: {
        likes: userLikesRank,
        mvm: userMvmRank,
        comments: userCommentsRank,
      },
      nextPayout: `${daysUntil}d ${remainingHours}h`,
    },
    comments: commentRows,
  });
}
