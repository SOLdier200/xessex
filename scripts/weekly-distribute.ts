/**
 * Weekly Distribution Script
 *
 * Computes who gets what for the current week and writes RewardEvents.
 * Run via: npx tsx scripts/weekly-distribute.ts
 *
 * This script is idempotent - it uses @@unique([refType, refId]) to prevent duplicates.
 *
 * Env vars:
 *   XESS_LAUNCH_WEEK_KEY - Week key when mainnet launched (e.g., "2026-01-13")
 *   XESS_REF_BUDGET_BPS - Referral budget in basis points (default: 1000 = 10%)
 */

import "dotenv/config";
import { PrismaClient, RewardType } from "@prisma/client";
import { weekKeyUTC, weekRangeUTC } from "./week";
import { weeklyEmissionAtomic } from "./emissions";
import { mulBps, formatXess } from "./xessMath";

const db = new PrismaClient();

type Winner = { userId: string; likes: number };
type MvmWinner = { userId: string; mvmPoints: number };

// ============================================
// CONFIGURATION
// ============================================

const LAUNCH_WEEK_KEY = process.env.XESS_LAUNCH_WEEK_KEY || "2026-01-13";
const REF_BUDGET_BPS = Number(process.env.XESS_REF_BUDGET_BPS || "1000"); // 10%

// Pool distribution (of remaining after ref budget)
const POOL_LIKES_BPS = 7500;   // 75%
const POOL_MVM_BPS = 2000;     // 20%
const POOL_COMMENTS_BPS = 500; // 5%

// Referral tiers (% of earner's rewards)
const REF_L1_BPS = 1000; // 10%
const REF_L2_BPS = 300;  // 3%
const REF_L3_BPS = 100;  // 1%

// Minimum likes to qualify for top 50
const MIN_LIKES_THRESHOLD = 10;

// Minimum MVM points to qualify for top 10
const MIN_MVM_THRESHOLD = 2;

// ============================================
// HELPERS
// ============================================

function weekIndexFromLaunch(currentWeekKey: string): number {
  const launch = new Date(LAUNCH_WEEK_KEY + "T00:00:00.000Z").getTime();
  const cur = new Date(currentWeekKey + "T00:00:00.000Z").getTime();
  const diffWeeks = Math.floor((cur - launch) / (7 * 24 * 3600 * 1000));
  return Math.max(0, diffWeeks);
}

async function upsertReward(
  userId: string,
  weekKey: string,
  type: RewardType,
  amount: bigint,
  refType: string,
  refId: string
): Promise<boolean> {
  try {
    await db.rewardEvent.create({
      data: { userId, weekKey, type, amount, refType, refId },
    });
    return true;
  } catch {
    // Unique constraint violation = already exists
    return false;
  }
}

/**
 * Ladder bonus distribution for LIKES Top 50
 * 1: 20%, 2: 12%, 3: 8%, 4-10: 35%/7 each, 11-50: 25%/40 each
 */
function likesLadderBonusAtomic(ladderPool: bigint, rank: number): bigint {
  if (rank === 1) return mulBps(ladderPool, 2000);
  if (rank === 2) return mulBps(ladderPool, 1200);
  if (rank === 3) return mulBps(ladderPool, 800);

  // Ranks 4-10: 35% evenly split
  if (rank >= 4 && rank <= 10) {
    const pool = mulBps(ladderPool, 3500);
    return pool / 7n;
  }

  // Ranks 11-50: 25% evenly split
  if (rank >= 11 && rank <= 50) {
    const pool = mulBps(ladderPool, 2500);
    return pool / 40n;
  }

  return 0n;
}

/**
 * Ladder bonus distribution for MVM Top 10
 * 1: 25%, 2: 15%, 3: 10%, 4-10: 50%/7 each
 */
function mvmLadderBonusAtomic(ladderPool: bigint, rank: number): bigint {
  if (rank === 1) return mulBps(ladderPool, 2500);
  if (rank === 2) return mulBps(ladderPool, 1500);
  if (rank === 3) return mulBps(ladderPool, 1000);

  // Ranks 4-10: 50% evenly split
  if (rank >= 4 && rank <= 10) {
    const pool = mulBps(ladderPool, 5000);
    return pool / 7n;
  }

  return 0n;
}

async function getTop50Likes(weekKey: string): Promise<Winner[]> {
  // Use WeeklyUserStat for accurate weekly likes tracking
  // This is populated by the vote route when likes are cast
  const top50 = await db.weeklyUserStat.findMany({
    where: {
      weekKey,
      likesReceived: { gte: MIN_LIKES_THRESHOLD },
    },
    orderBy: { likesReceived: "desc" },
    take: 50,
    select: { userId: true, likesReceived: true },
  });

  return top50.map((r) => ({
    userId: r.userId,
    likes: r.likesReceived,
  }));
}

async function getTop10Mvm(weekKey: string): Promise<MvmWinner[]> {
  // Use WeeklyUserStat for weekly MVM tracking
  // Users must have >= MIN_MVM_THRESHOLD points to qualify
  const top10 = await db.weeklyUserStat.findMany({
    where: {
      weekKey,
      mvmPoints: { gte: MIN_MVM_THRESHOLD },
    },
    orderBy: { mvmPoints: "desc" },
    take: 10,
    select: { userId: true, mvmPoints: true },
  });

  return top10.map((r) => ({
    userId: r.userId,
    mvmPoints: r.mvmPoints,
  }));
}

async function getDiamondCommentCounts(weekKey: string, weekStart: Date, weekEnd: Date): Promise<Map<string, number>> {
  // Try to get from WeeklyUserStat first
  const stats = await db.weeklyUserStat.findMany({
    where: { weekKey },
    select: { userId: true, diamondComments: true },
  });

  if (stats.length > 0) {
    const m = new Map<string, number>();
    for (const s of stats) if (s.diamondComments > 0) m.set(s.userId, s.diamondComments);
    return m;
  }

  // Fallback: calculate from comments table
  const comments = await db.comment.findMany({
    where: {
      createdAt: { gte: weekStart, lt: weekEnd },
      status: "ACTIVE",
      author: {
        subscription: {
          tier: "DIAMOND",
          status: "ACTIVE",
        },
      },
    },
    select: { authorId: true },
  });

  const m = new Map<string, number>();
  for (const c of comments) {
    m.set(c.authorId, (m.get(c.authorId) || 0) + 1);
  }
  return m;
}

async function referralChain(userId: string): Promise<string[]> {
  // Returns [L1, L2, L3] userIds (if exist)
  const u1 = await db.user.findUnique({
    where: { id: userId },
    select: { referredById: true },
  });
  if (!u1?.referredById) return [];
  const l1 = u1.referredById;

  const u2 = await db.user.findUnique({
    where: { id: l1 },
    select: { referredById: true },
  });
  const l2 = u2?.referredById || null;

  let l3: string | null = null;
  if (l2) {
    const u3 = await db.user.findUnique({
      where: { id: l2 },
      select: { referredById: true },
    });
    l3 = u3?.referredById || null;
  }

  return [l1, ...(l2 ? [l2] : []), ...(l3 ? [l3] : [])];
}

// ============================================
// MAIN
// ============================================

async function main() {
  const now = new Date();
  const wk = weekKeyUTC(now);
  const { start, end } = weekRangeUTC(wk);

  console.log(`[weekly-distribute] Processing week: ${wk}`);
  console.log(`[weekly-distribute] Range: ${start.toISOString()} to ${end.toISOString()}`);

  const weekIndex = weekIndexFromLaunch(wk);
  const emission = weeklyEmissionAtomic(weekIndex);

  console.log(`[weekly-distribute] Week index from launch: ${weekIndex}`);
  console.log(`[weekly-distribute] Weekly emission: ${formatXess(emission)} XESS`);

  const refBudget = mulBps(emission, REF_BUDGET_BPS);
  const remaining = emission - refBudget;

  const likesPool = mulBps(remaining, POOL_LIKES_BPS);
  const mvmPool = mulBps(remaining, POOL_MVM_BPS);
  const commentsPool = mulBps(remaining, POOL_COMMENTS_BPS);

  console.log(`\n[weekly-distribute] Pool breakdown:`);
  console.log(`  Likes pool (75%): ${formatXess(likesPool)} XESS`);
  console.log(`  MVM pool (20%): ${formatXess(mvmPool)} XESS`);
  console.log(`  Comments pool (5%): ${formatXess(commentsPool)} XESS`);
  console.log(`  Referral budget (10%): ${formatXess(refBudget)} XESS`);

  // Track each user's base earned (for referrals)
  const earnedByUser = new Map<string, bigint>();

  // ============================================
  // 1. LIKES WINNERS (Top 50)
  // ============================================
  console.log(`\n[weekly-distribute] === LIKES REWARDS (Top 50, >= ${MIN_LIKES_THRESHOLD} likes) ===`);

  const top50 = await getTop50Likes(wk);
  const sumLikes = top50.reduce((acc, w) => acc + w.likes, 0);

  console.log(`[weekly-distribute] Found ${top50.length} users with >= ${MIN_LIKES_THRESHOLD} likes`);
  console.log(`[weekly-distribute] Total likes in top 50: ${sumLikes}`);

  // Split likes pool: 80% base (proportional), 20% ladder bonus
  const likesBasePool = mulBps(likesPool, 8000);
  const likesLadderPool = likesPool - likesBasePool;

  let likesCreated = 0;
  for (let i = 0; i < top50.length; i++) {
    const rank = i + 1;
    const w = top50[i];

    const base =
      sumLikes > 0
        ? (likesBasePool * BigInt(w.likes)) / BigInt(sumLikes)
        : 0n;

    const bonus = likesLadderBonusAtomic(likesLadderPool, rank);
    const total = base + bonus;

    earnedByUser.set(w.userId, (earnedByUser.get(w.userId) || 0n) + total);

    const created = await upsertReward(
      w.userId,
      wk,
      RewardType.WEEKLY_LIKES,
      total,
      "weekly_likes",
      `${wk}:${w.userId}`
    );

    if (created) {
      likesCreated++;
      console.log(`  Rank ${rank}: ${w.userId.slice(0, 8)}... - ${w.likes} likes - ${formatXess(total)} XESS`);
    } else {
      console.log(`  Rank ${rank}: ${w.userId.slice(0, 8)}... - SKIPPED (exists)`);
    }
  }
  console.log(`[weekly-distribute] Created ${likesCreated} likes rewards`);

  // ============================================
  // 2. MVM POOL (Top 10 with ladder)
  // ============================================
  console.log(`\n[weekly-distribute] === MVM REWARDS (Top 10, >= ${MIN_MVM_THRESHOLD} points) ===`);

  const top10Mvm = await getTop10Mvm(wk);
  const sumMvm = top10Mvm.reduce((acc, w) => acc + w.mvmPoints, 0);

  console.log(`[weekly-distribute] Found ${top10Mvm.length} users with >= ${MIN_MVM_THRESHOLD} MVM points`);
  console.log(`[weekly-distribute] Total MVM points in top 10: ${sumMvm}`);

  // Split MVM pool: 60% base (proportional), 40% ladder bonus
  const mvmBasePool = mulBps(mvmPool, 6000);
  const mvmLadderPool = mvmPool - mvmBasePool;

  let mvmCreated = 0;
  for (let i = 0; i < top10Mvm.length; i++) {
    const rank = i + 1;
    const w = top10Mvm[i];

    const base =
      sumMvm > 0
        ? (mvmBasePool * BigInt(w.mvmPoints)) / BigInt(sumMvm)
        : 0n;

    const bonus = mvmLadderBonusAtomic(mvmLadderPool, rank);
    const total = base + bonus;

    earnedByUser.set(w.userId, (earnedByUser.get(w.userId) || 0n) + total);

    const created = await upsertReward(
      w.userId,
      wk,
      RewardType.WEEKLY_MVM,
      total,
      "weekly_mvm",
      `${wk}:${w.userId}`
    );

    if (created) {
      mvmCreated++;
      console.log(`  Rank ${rank}: ${w.userId.slice(0, 8)}... - ${w.mvmPoints} MVM - ${formatXess(total)} XESS`);
    } else {
      console.log(`  Rank ${rank}: ${w.userId.slice(0, 8)}... - SKIPPED (exists)`);
    }
  }
  console.log(`[weekly-distribute] Created ${mvmCreated} MVM rewards`);

  // ============================================
  // 3. DIAMOND COMMENTS POOL
  // ============================================
  console.log(`\n[weekly-distribute] === DIAMOND COMMENTS REWARDS ===`);

  const cc = await getDiamondCommentCounts(wk, start, end);
  const sumC = [...cc.values()].reduce((a, b) => a + b, 0);

  console.log(`[weekly-distribute] Found ${cc.size} Diamond users with ${sumC} total comments`);

  let commentsCreated = 0;
  for (const [userId, count] of cc.entries()) {
    const amt = sumC > 0 ? (commentsPool * BigInt(count)) / BigInt(sumC) : 0n;
    if (amt <= 0n) continue;

    earnedByUser.set(userId, (earnedByUser.get(userId) || 0n) + amt);

    const created = await upsertReward(
      userId,
      wk,
      RewardType.WEEKLY_COMMENTS,
      amt,
      "weekly_comments",
      `${wk}:${userId}`
    );

    if (created) {
      commentsCreated++;
      console.log(`  ${userId.slice(0, 8)}... - ${count} comments - ${formatXess(amt)} XESS`);
    }
  }
  console.log(`[weekly-distribute] Created ${commentsCreated} comments rewards`);

  // ============================================
  // 4. REFERRAL STREAMS
  // ============================================
  console.log(`\n[weekly-distribute] === REFERRAL REWARDS ===`);

  type RefReward = {
    userId: string;
    amount: bigint;
    type: RewardType;
    refId: string;
  };

  const referralOwed: RefReward[] = [];
  let totalReferralOwed = 0n;

  for (const [earnerId, earned] of earnedByUser.entries()) {
    if (earned <= 0n) continue;

    const chain = await referralChain(earnerId);
    if (chain.length === 0) continue;

    const l1 = chain[0];
    const l2 = chain[1] || null;
    const l3 = chain[2] || null;

    const a1 = mulBps(earned, REF_L1_BPS);
    if (a1 > 0n) {
      referralOwed.push({
        userId: l1,
        amount: a1,
        type: RewardType.REF_L1,
        refId: `${wk}:${earnerId}:L1`,
      });
      totalReferralOwed += a1;
    }

    if (l2) {
      const a2 = mulBps(earned, REF_L2_BPS);
      if (a2 > 0n) {
        referralOwed.push({
          userId: l2,
          amount: a2,
          type: RewardType.REF_L2,
          refId: `${wk}:${earnerId}:L2`,
        });
        totalReferralOwed += a2;
      }
    }

    if (l3) {
      const a3 = mulBps(earned, REF_L3_BPS);
      if (a3 > 0n) {
        referralOwed.push({
          userId: l3,
          amount: a3,
          type: RewardType.REF_L3,
          refId: `${wk}:${earnerId}:L3`,
        });
        totalReferralOwed += a3;
      }
    }
  }

  console.log(`[weekly-distribute] Total referral owed: ${formatXess(totalReferralOwed)} XESS`);
  console.log(`[weekly-distribute] Referral budget: ${formatXess(refBudget)} XESS`);

  // Scale down if owed exceeds budget
  const scale =
    totalReferralOwed > refBudget
      ? (refBudget * 1_000_000n) / totalReferralOwed
      : 1_000_000n;

  if (scale < 1_000_000n) {
    console.log(`[weekly-distribute] Scaling referrals to ${(Number(scale) / 10000).toFixed(2)}%`);
  }

  let refCreated = 0;
  for (const r of referralOwed) {
    const scaled = (r.amount * scale) / 1_000_000n;
    if (scaled <= 0n) continue;

    const created = await upsertReward(
      r.userId,
      wk,
      r.type,
      scaled,
      "weekly_ref",
      r.refId
    );

    if (created) {
      refCreated++;
      const tierLabel = r.type === RewardType.REF_L1 ? "L1" : r.type === RewardType.REF_L2 ? "L2" : "L3";
      console.log(`  ${tierLabel}: ${r.userId.slice(0, 8)}... - ${formatXess(scaled)} XESS`);
    }
  }
  console.log(`[weekly-distribute] Created ${refCreated} referral rewards`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log(`\n[weekly-distribute] === SUMMARY ===`);

  const pending = await db.rewardEvent.aggregate({
    where: { weekKey: wk, status: "PENDING" },
    _sum: { amount: true },
    _count: true,
  });

  console.log(`[weekly-distribute] Week: ${wk}`);
  console.log(`[weekly-distribute] Total PENDING rewards: ${pending._count}`);
  console.log(`[weekly-distribute] Total PENDING amount: ${formatXess(pending._sum.amount || 0n)} XESS`);
  console.log(`\n[weekly-distribute] Done! Run weekly-payout.ts to send tokens.`);
}

main()
  .then(() => db.$disconnect())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[weekly-distribute] Error:", e);
    db.$disconnect();
    process.exit(1);
  });
