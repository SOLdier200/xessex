import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { monthKeyUTC } from "@/lib/weekKey";
import { getAdminConfig } from "@/lib/adminConfig";
import { Prisma, BatchStatus } from "@prisma/client";

// Stale batch threshold (30 minutes) - RUNNING batches older than this can be force-reset
const STALE_BATCH_MS = 30 * 60 * 1000;

// Verify cron secret
const CRON_SECRET = process.env.CRON_SECRET || "";

// Emission schedule (in XESS tokens, 6 decimals)
// IMPORTANT: RewardEvent.amount is stored with 6 decimals.
// The claimables aggregator converts to 9 decimals for on-chain use.
// See: src/lib/claimables.ts for conversion logic.
const EMISSION_DECIMALS = 6n;
const EMISSION_MULTIPLIER = 10n ** EMISSION_DECIMALS;

// Updated for 200M total rewards (20% of 1B supply)
function getWeeklyEmission(weekIndex: number): bigint {
  if (weekIndex < 12) return 666_667n * EMISSION_MULTIPLIER;  // Phase 1: ~8M total
  if (weekIndex < 39) return 500_000n * EMISSION_MULTIPLIER;  // Phase 2: ~13.5M total
  if (weekIndex < 78) return 333_333n * EMISSION_MULTIPLIER;  // Phase 3: ~13M total
  return 166_667n * EMISSION_MULTIPLIER;                      // Phase 4: ~165.5M remaining
}

// Pool split percentages (in basis points, 10000 = 100%)
const LIKES_POOL_BPS = 7000n;    // 70%
const MVM_POOL_BPS = 2000n;      // 20%
const COMMENTS_POOL_BPS = 500n;  // 5%
const REFERRALS_POOL_BPS = 500n; // 5%

// Referral tiers (% of earner's rewards, capped by referral pool budget)
const REF_L1_BPS = 1000n; // 10% of earner's rewards
const REF_L2_BPS = 300n;  // 3%
const REF_L3_BPS = 100n;  // 1%

// Ladder percentages for top 50
const LADDER_PERCENTS: number[] = [
  20,   // Rank 1
  12,   // Rank 2
  8,    // Rank 3
  5, 5, 5, 5, 5, 5, 5,  // Ranks 4-10 (5% each)
  ...Array(40).fill(0.625),  // Ranks 11-50 (0.625% each)
];

type Winner = { userId: string; score: number };

interface UserReward {
  userId: string;
  walletAddress: string | null;  // null for voters without wallet - they can claim when they link one
  amount: bigint;
  type: "WEEKLY_LIKES" | "WEEKLY_MVM" | "WEEKLY_COMMENTS" | "WEEKLY_VOTER" | "ALLTIME_LIKES" | "REF_L1" | "REF_L2" | "REF_L3";
  referralFromUserId?: string | null; // for referral rewards, the earning user
}

/**
 * Get referral chain for a user (up to 3 levels)
 * Returns [L1, L2, L3] userIds with their wallets (solWallet preferred, walletAddress as fallback)
 */
async function getReferralChain(userId: string): Promise<{ id: string; wallet: string }[]> {
  const chain: { id: string; wallet: string }[] = [];

  const u1 = await db.user.findUnique({
    where: { id: userId },
    select: { referredById: true },
  });
  if (!u1?.referredById) return chain;

  // L1 - direct referrer
  const l1User = await db.user.findUnique({
    where: { id: u1.referredById },
    select: { id: true, solWallet: true, walletAddress: true, referredById: true },
  });
  const l1Wallet = l1User?.solWallet || l1User?.walletAddress;
  if (l1User && l1Wallet) {
    chain.push({ id: l1User.id, wallet: l1Wallet });
  }

  if (!l1User?.referredById) return chain;

  // L2 - referrer's referrer
  const l2User = await db.user.findUnique({
    where: { id: l1User.referredById },
    select: { id: true, solWallet: true, walletAddress: true, referredById: true },
  });
  const l2Wallet = l2User?.solWallet || l2User?.walletAddress;
  if (l2User && l2Wallet) {
    chain.push({ id: l2User.id, wallet: l2Wallet });
  }

  if (!l2User?.referredById) return chain;

  // L3 - L2's referrer
  const l3User = await db.user.findUnique({
    where: { id: l2User.referredById },
    select: { id: true, solWallet: true, walletAddress: true },
  });
  const l3Wallet = l3User?.solWallet || l3User?.walletAddress;
  if (l3User && l3Wallet) {
    chain.push({ id: l3User.id, wallet: l3Wallet });
  }

  return chain;
}

function formatXess(amount: bigint): string {
  const whole = amount / EMISSION_MULTIPLIER;
  const frac = amount % EMISSION_MULTIPLIER;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

/**
 * Eligibility filter for payouts (wallet-native model):
 * - ALL users are eligible since everyone must have a wallet to have an account
 * - walletAddress is required for all users (login wallet)
 * - solWallet is optional override for payout destination
 */
function eligibleUserWhere(): Prisma.UserWhereInput {
  return {
    walletAddress: { not: null },  // All users have this (required for account)
  };
}

/**
 * Get top 50 users by weekly scoreReceived (users with linked wallets)
 */
async function getTop50Score(weekKey: string, minThreshold: number, now: Date): Promise<Winner[]> {
  const top50 = await db.weeklyUserStat.findMany({
    where: {
      weekKey,
      scoreReceived: { gte: minThreshold },
      user: eligibleUserWhere(),
    },
    orderBy: { scoreReceived: "desc" },
    take: 50,
    select: { userId: true, scoreReceived: true },
  });

  return top50.map((r) => ({
    userId: r.userId,
    score: r.scoreReceived,
  }));
}

/**
 * POST /api/cron/rewards/weekly-distribute
 * Weekly distribution job - creates RewardEvents for all eligible users
 *
 * Query params:
 * - weekKey: The week to process (e.g., "2026-01-13")
 * - weekIndex: The 0-based week index for emission schedule
 */
export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || authHeader !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const weekKey = searchParams.get("weekKey"); // payout week
  const statsWeekKey = searchParams.get("statsWeekKey") || weekKey; // stats source week
  const weekIndexStr = searchParams.get("weekIndex");
  const force = searchParams.get("force") === "1" || searchParams.get("force") === "true";

  if (!weekKey || !weekIndexStr) {
    return NextResponse.json(
      { ok: false, error: "MISSING_PARAMS", required: ["weekKey", "weekIndex"] },
      { status: 400 }
    );
  }

  const weekIndex = parseInt(weekIndexStr, 10);
  if (isNaN(weekIndex) || weekIndex < 0) {
    return NextResponse.json(
      { ok: false, error: "INVALID_WEEK_INDEX" },
      { status: 400 }
    );
  }

  const now = new Date();
  const runId = `${weekKey}-${now.getTime()}`;

  // Check for existing batch and handle idempotency
  const existingBatch = await db.rewardBatch.findUnique({ where: { weekKey } });

  if (existingBatch) {
    // Already completed - return success (idempotent)
    if (existingBatch.status === BatchStatus.DONE) {
      if (!force) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "already_processed",
          weekKey,
          batchId: existingBatch.id,
          totalUsers: existingBatch.totalUsers,
          totalAmount: existingBatch.totalAmount?.toString(),
        });
      }

      // Force rerun: refuse if any epoch for this week is already on-chain
      const onChainEpoch = await db.claimEpoch.findFirst({
        where: { weekKey, setOnChain: true },
        select: { epoch: true, version: true },
      });
      if (onChainEpoch) {
        return NextResponse.json({
          ok: false,
          error: "EPOCH_ONCHAIN",
          message: `Epoch ${onChainEpoch.epoch} (v${onChainEpoch.version}) is already on-chain. Refusing to rerun.`,
          weekKey,
        }, { status: 409 });
      }

      // Clear derived data for force rerun
      await db.$transaction(async (tx) => {
        await tx.claimLeaf.deleteMany({ where: { weekKey } });
        await tx.claimEpoch.deleteMany({ where: { weekKey } });
        await tx.rewardEvent.deleteMany({ where: { weekKey } });
        await tx.rewardBatch.delete({ where: { weekKey } });
        if (statsWeekKey) {
          await tx.weeklyUserStat.updateMany({
            where: { weekKey: statsWeekKey },
            data: { paidAtomic: 0n },
          });
        }
      });
      // Continue to re-process below
    }
    // Currently running
    else if (existingBatch.status === BatchStatus.RUNNING) {
      const batchAge = now.getTime() - existingBatch.startedAt.getTime();

      // If stale (older than threshold), allow force takeover
      if (batchAge > STALE_BATCH_MS && force) {
        console.log(`[weekly-distribute] Stale batch detected (${Math.round(batchAge / 1000)}s old), force resetting...`);
        await db.$transaction(async (tx) => {
          await tx.claimLeaf.deleteMany({ where: { weekKey } });
          await tx.claimEpoch.deleteMany({ where: { weekKey } });
          await tx.rewardEvent.deleteMany({ where: { weekKey } });
          await tx.rewardBatch.delete({ where: { weekKey } });
          if (statsWeekKey) {
            await tx.weeklyUserStat.updateMany({
              where: { weekKey: statsWeekKey },
              data: { paidAtomic: 0n },
            });
          }
        });
        // Continue to re-process below
      } else {
        // Another run is in progress - return success (idempotent "in progress")
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "already_running",
          weekKey,
          batchId: existingBatch.id,
          startedAt: existingBatch.startedAt.toISOString(),
          runId: existingBatch.runId,
        });
      }
    }
    // Failed batch - allow retry
    else if (existingBatch.status === BatchStatus.FAILED) {
      console.log(`[weekly-distribute] Previous batch failed, clearing and retrying...`);
      await db.$transaction(async (tx) => {
        await tx.claimLeaf.deleteMany({ where: { weekKey } });
        await tx.claimEpoch.deleteMany({ where: { weekKey } });
        await tx.rewardEvent.deleteMany({ where: { weekKey } });
        await tx.rewardBatch.delete({ where: { weekKey } });
        if (statsWeekKey) {
          await tx.weeklyUserStat.updateMany({
            where: { weekKey: statsWeekKey },
            data: { paidAtomic: 0n },
          });
        }
      });
      // Continue to re-process below
    }
  }

  // Claim this week by creating the batch row with RUNNING status
  let batch;
  try {
    batch = await db.rewardBatch.create({
      data: {
        weekKey,
        status: BatchStatus.RUNNING,
        runId,
        startedAt: now,
      },
    });
  } catch (e: any) {
    // Unique constraint violation - another process claimed it
    if (e?.code === "P2002") {
      const existing = await db.rewardBatch.findUnique({ where: { weekKey } });
      if (existing?.status === BatchStatus.DONE) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "already_processed",
          weekKey,
          batchId: existing.id,
        });
      }
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "already_running",
        weekKey,
        batchId: existing?.id,
      });
    }
    throw e;
  }

  try {
    // Load admin config (thresholds and pool slices)
    const cfg = await getAdminConfig();
    const minWeeklyScoreThreshold = cfg.minWeeklyScoreThreshold;
    const minMvmThreshold = cfg.minMvmThreshold;
    const allTimeLikesBps = BigInt(cfg.allTimeLikesBpsOfLikes);
    const memberVoterBps = BigInt(cfg.memberVoterBpsOfLikes);
    // Remaining goes to weekly diamond likes
    const weeklyDiamondBps = 10000n - allTimeLikesBps - memberVoterBps;

    // Calculate emission and pools
    const totalEmission = getWeeklyEmission(weekIndex);
    const likesPool = (totalEmission * LIKES_POOL_BPS) / 10000n;
    const mvmPool = (totalEmission * MVM_POOL_BPS) / 10000n;
    const commentsPool = (totalEmission * COMMENTS_POOL_BPS) / 10000n;
    const referralsPool = (totalEmission * REFERRALS_POOL_BPS) / 10000n;

    // Likes pool sub-pools
    const weeklyDiamondPool = (likesPool * weeklyDiamondBps) / 10000n;
    const allTimeLikesPool = (likesPool * allTimeLikesBps) / 10000n;
    const memberVoterPool = (likesPool * memberVoterBps) / 10000n;

    console.log(`[weekly-distribute] Payout Week ${weekKey} (index ${weekIndex})`);
    if (statsWeekKey && statsWeekKey !== weekKey) {
      console.log(`[weekly-distribute] Stats Source Week ${statsWeekKey}`);
    }
    console.log(`[weekly-distribute] Emission: ${formatXess(totalEmission)} XESS`);
    console.log(`[weekly-distribute] Pools - Likes: ${formatXess(likesPool)}, MVM: ${formatXess(mvmPool)}, Comments: ${formatXess(commentsPool)}, Referrals: ${formatXess(referralsPool)}`);
    console.log(`[weekly-distribute] Likes sub-pools - Weekly: ${formatXess(weeklyDiamondPool)}, AllTime: ${formatXess(allTimeLikesPool)}, Voter: ${formatXess(memberVoterPool)}`);

    const rewards: UserReward[] = [];

    // 1. Weekly Diamond Score (top 50 by scoreReceived) - wallet required
    console.log(`\n[weekly-distribute] === WEEKLY SCORE REWARDS (Top 50, >= ${minWeeklyScoreThreshold} score) ===`);
    const top50 = await getTop50Score(statsWeekKey!, minWeeklyScoreThreshold, now);
    const sumScore = top50.reduce((acc, w) => acc + w.score, 0);

    console.log(`[weekly-distribute] Found ${top50.length} eligible users with >= ${minWeeklyScoreThreshold} weekly score`);
    console.log(`[weekly-distribute] Total weekly score in top 50: ${sumScore}`);

    if (top50.length > 0) {
      const basePool = (weeklyDiamondPool * 80n) / 100n;  // 80% proportional
      const ladderPool = (weeklyDiamondPool * 20n) / 100n; // 20% ladder

      // Get wallet addresses for winners (solWallet preferred, walletAddress as fallback)
      const userIds = top50.map(w => w.userId);
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, solWallet: true, walletAddress: true },
      });
      const walletMap = new Map(users.map(u => [u.id, u.solWallet || u.walletAddress]));

      for (let i = 0; i < top50.length; i++) {
        const w = top50[i];
        const wallet = walletMap.get(w.userId);
        if (!wallet) continue;  // Should never happen since all users have walletAddress

        // Base reward (proportional to score)
        const base = sumScore > 0
          ? (basePool * BigInt(w.score)) / BigInt(sumScore)
          : 0n;

        // Ladder reward (by rank)
        const ladderPercent = LADDER_PERCENTS[i] || 0;
        const ladder = (ladderPool * BigInt(Math.round(ladderPercent * 1000))) / 100000n;

        const total = base + ladder;
        if (total > 0n) {
          console.log(`  Rank ${i + 1}: ${w.userId.slice(0, 8)}... - score ${w.score} - ${formatXess(total)} XESS`);
          rewards.push({
            userId: w.userId,
            walletAddress: wallet,
            amount: total,
            type: "WEEKLY_LIKES",
          });
        }
      }
    }

    // 2. All-Time Likes (top 50 by all-time scoreReceived) - all users eligible
    console.log(`\n[weekly-distribute] === ALL-TIME SCORE REWARDS ===`);
    const allTimeStats = await db.allTimeUserStat.findMany({
      where: {
        scoreReceived: { gt: 0 },
        user: eligibleUserWhere(),
      },
      orderBy: { scoreReceived: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, solWallet: true, walletAddress: true } },
      },
    });

    if (allTimeStats.length > 0 && allTimeLikesPool > 0n) {
      const totalAllTimeScore = allTimeStats.reduce((sum, s) => sum + s.scoreReceived, 0);
      const basePool = (allTimeLikesPool * 80n) / 100n;
      const ladderPool = (allTimeLikesPool * 20n) / 100n;

      console.log(`[weekly-distribute] All-time top ${allTimeStats.length} eligible users, total score: ${totalAllTimeScore}`);

      for (let i = 0; i < allTimeStats.length; i++) {
        const stat = allTimeStats[i];
        const payoutWallet = stat.user.solWallet || stat.user.walletAddress;

        const baseReward = totalAllTimeScore > 0
          ? (basePool * BigInt(stat.scoreReceived)) / BigInt(totalAllTimeScore)
          : 0n;

        const ladderPercent = LADDER_PERCENTS[i] || 0;
        const ladderReward = (ladderPool * BigInt(Math.round(ladderPercent * 1000))) / 100000n;

        const totalReward = baseReward + ladderReward;
        if (totalReward > 0n) {
          rewards.push({
            userId: stat.userId,
            walletAddress: payoutWallet,
            amount: totalReward,
            type: "ALLTIME_LIKES",
          });
        }
      }
    } else {
      console.log(`[weekly-distribute] No eligible users for all-time rewards or pool is 0`);
    }

    // 3. Voter Rewards (proportional to votes cast) - all users eligible
    console.log(`\n[weekly-distribute] === VOTER REWARDS ===`);
    const voterStats = await db.weeklyVoterStat.findMany({
      where: {
        weekKey: statsWeekKey!,
        votesCast: { gt: 0 },
        user: eligibleUserWhere(),
      },
      include: {
        user: { select: { id: true, solWallet: true, walletAddress: true } },
      },
    });

    if (voterStats.length > 0 && memberVoterPool > 0n) {
      const totalVotes = voterStats.reduce((sum, s) => sum + s.votesCast, 0);
      console.log(`[weekly-distribute] Voter rewards: ${voterStats.length} voters, ${totalVotes} total votes`);

      for (const stat of voterStats) {
        const payoutWallet = stat.user.solWallet || stat.user.walletAddress;
        const reward = (memberVoterPool * BigInt(stat.votesCast)) / BigInt(totalVotes);
        if (reward > 0n) {
          rewards.push({
            userId: stat.userId,
            walletAddress: payoutWallet,
            amount: reward,
            type: "WEEKLY_VOTER",
          });
        }
      }
    } else {
      console.log(`[weekly-distribute] No voters or pool is 0`);
    }

    // 4. MVM Pool (monthly stats, weekly payout) - all users eligible
    console.log(`\n[weekly-distribute] === MVM REWARDS (Monthly ranking) ===`);
    const monthKey = monthKeyUTC(new Date(statsWeekKey!));
    const mvmStats = await db.monthlyUserStat.findMany({
      where: {
        monthKey,
        mvmPoints: { gte: minMvmThreshold },
        user: eligibleUserWhere(),
      },
      orderBy: { mvmPoints: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, solWallet: true, walletAddress: true } },
      },
    });

    // Check if ANY MVM points exist this month (skip payout if 0)
    const totalMonthMvm = mvmStats.reduce((sum, s) => sum + s.mvmPoints, 0);
    if (totalMonthMvm === 0) {
      console.log(`[weekly-distribute] No MVM points this month - skipping MVM payout (withheld to treasury)`);
    } else if (mvmStats.length > 0) {
      const basePool = (mvmPool * 80n) / 100n;
      const ladderPool = (mvmPool * 20n) / 100n;

      console.log(`[weekly-distribute] MVM rewards: ${mvmStats.length} eligible users, ${totalMonthMvm} total MVM points`);

      for (let i = 0; i < mvmStats.length; i++) {
        const stat = mvmStats[i];
        const payoutWallet = stat.user.solWallet || stat.user.walletAddress;

        const baseReward = totalMonthMvm > 0
          ? (basePool * BigInt(stat.mvmPoints)) / BigInt(totalMonthMvm)
          : 0n;

        const ladderPercent = LADDER_PERCENTS[i] || 0;
        const ladderReward = (ladderPool * BigInt(Math.round(ladderPercent * 1000))) / 100000n;

        const totalReward = baseReward + ladderReward;
        if (totalReward > 0n) {
          rewards.push({
            userId: stat.userId,
            walletAddress: payoutWallet,
            amount: totalReward,
            type: "WEEKLY_MVM",
          });
        }
      }
    } else {
      console.log(`[weekly-distribute] No eligible users for MVM rewards`);
    }

    // 5. Comments Pool (proportional to comments made) - all users eligible
    console.log(`\n[weekly-distribute] === COMMENTS REWARDS ===`);

    const commentStats = await db.weeklyUserStat.findMany({
      where: {
        weekKey: statsWeekKey!,
        diamondComments: { gt: 0 },
        user: eligibleUserWhere(),
      },
      include: {
        user: { select: { id: true, solWallet: true, walletAddress: true } },
      },
    });
    console.log(`[weekly-distribute] Found ${commentStats.length} eligible users with comments`);

    if (commentStats.length > 0) {
      const totalComments = commentStats.reduce((sum, s) => sum + s.diamondComments, 0);
      console.log(`[weekly-distribute] Comments rewards: ${commentStats.length} eligible commenters, ${totalComments} total comments`);

      for (const stat of commentStats) {
        const payoutWallet = stat.user.solWallet || stat.user.walletAddress;
        const reward = (commentsPool * BigInt(stat.diamondComments)) / BigInt(totalComments);
        if (reward > 0n) {
          rewards.push({
            userId: stat.userId,
            walletAddress: payoutWallet,
            amount: reward,
            type: "WEEKLY_COMMENTS",
          });
        }
      }
    } else {
      console.log(`[weekly-distribute] No eligible commenters`);
    }

    // 6. Referral Rewards (% of each earner's rewards, capped by referral pool budget)
    console.log(`\n[weekly-distribute] === REFERRAL REWARDS ===`);

    // Track base earnings by user (for calculating referral shares)
    const earnedByUser = new Map<string, bigint>();
    for (const r of rewards) {
      const current = earnedByUser.get(r.userId) || 0n;
      earnedByUser.set(r.userId, current + r.amount);
    }

    interface RefReward {
      userId: string;
      walletAddress: string;
      amount: bigint;
      type: "REF_L1" | "REF_L2" | "REF_L3";
      earnerId: string;
    }

    const referralOwed: RefReward[] = [];
    let totalReferralOwed = 0n;

    for (const [earnerId, earned] of earnedByUser.entries()) {
      if (earned <= 0n) continue;

      const chain = await getReferralChain(earnerId);
      if (chain.length === 0) continue;

      // L1 - direct referrer gets 10% of earner's rewards
      if (chain[0]) {
        const a1 = (earned * REF_L1_BPS) / 10000n;
        if (a1 > 0n) {
          referralOwed.push({
            userId: chain[0].id,
            walletAddress: chain[0].wallet,
            amount: a1,
            type: "REF_L1",
            earnerId,
          });
          totalReferralOwed += a1;
        }
      }

      // L2 - referrer's referrer gets 3%
      if (chain[1]) {
        const a2 = (earned * REF_L2_BPS) / 10000n;
        if (a2 > 0n) {
          referralOwed.push({
            userId: chain[1].id,
            walletAddress: chain[1].wallet,
            amount: a2,
            type: "REF_L2",
            earnerId,
          });
          totalReferralOwed += a2;
        }
      }

      // L3 - L2's referrer gets 1%
      if (chain[2]) {
        const a3 = (earned * REF_L3_BPS) / 10000n;
        if (a3 > 0n) {
          referralOwed.push({
            userId: chain[2].id,
            walletAddress: chain[2].wallet,
            amount: a3,
            type: "REF_L3",
            earnerId,
          });
          totalReferralOwed += a3;
        }
      }
    }

    console.log(`[weekly-distribute] Total referral owed: ${formatXess(totalReferralOwed)} XESS`);
    console.log(`[weekly-distribute] Referral budget: ${formatXess(referralsPool)} XESS`);

    // Scale down if owed exceeds budget
    const scale = totalReferralOwed > referralsPool
      ? (referralsPool * 1_000_000n) / totalReferralOwed
      : 1_000_000n;

    if (scale < 1_000_000n) {
      console.log(`[weekly-distribute] Scaling referrals to ${(Number(scale) / 10000).toFixed(2)}%`);
    }

    // Create referral rewards per earner (keeps per-referral attribution)
    let refCreated = 0;
    for (const r of referralOwed) {
      const scaled = (r.amount * scale) / 1_000_000n;
      if (scaled <= 0n) continue;

      rewards.push({
        userId: r.userId,
        walletAddress: r.walletAddress,
        amount: scaled,
        type: r.type,
        referralFromUserId: r.earnerId,
      });
      refCreated++;

      const tierLabel = r.type;
      console.log(`  ${tierLabel}: ${r.userId.slice(0, 8)}... (from ${r.earnerId.slice(0, 8)}...) - ${formatXess(scaled)} XESS`);
    }
    console.log(`[weekly-distribute] Created ${refCreated} referral rewards (per earner)`);

    // Aggregate rewards by user for summary
    const userRewards = new Map<string, { amount: bigint; wallet: string | null; types: Set<string> }>();
    for (const r of rewards) {
      const existing = userRewards.get(r.userId);
      if (existing) {
        existing.amount += r.amount;
        existing.types.add(r.type);
        // Update wallet if we have one and didn't before
        if (r.walletAddress && !existing.wallet) {
          existing.wallet = r.walletAddress;
        }
      } else {
        userRewards.set(r.userId, {
          amount: r.amount,
          wallet: r.walletAddress,
          types: new Set([r.type]),
        });
      }
    }

    console.log(`\n[weekly-distribute] Total rewards: ${rewards.length}, unique users: ${userRewards.size}`);

    // Total amount for this week
    const totalAmount = Array.from(userRewards.values()).reduce((sum, r) => sum + r.amount, 0n);

    // Prepare RewardEvent data for createMany
    // NOTE: Merkle tree is built separately by build-week cron using our Solana-compatible merkle library.
    // RewardEvents are marked PAID here so build-week can aggregate them into a ClaimEpoch.
    const rewardEventData = rewards.map((reward) => {
      const refType = reward.type === "WEEKLY_LIKES" ? "weekly_score" : `weekly_${reward.type.toLowerCase()}`;
      const isReferral = reward.type.startsWith("REF_");
      const refId = isReferral && reward.referralFromUserId
        ? `${weekKey}:${reward.userId}:${reward.referralFromUserId}:${refType}`
        : `${weekKey}:${reward.userId}:${refType}`;

      return {
        userId: reward.userId,
        referralFromUserId: reward.referralFromUserId ?? null,
        type: reward.type,
        amount: reward.amount,
        status: "PAID" as const,  // Mark as PAID so build-week picks them up
        weekKey,
        refType,
        refId,
      };
    });

    // Create RewardEvents and update batch in a transaction
    await db.$transaction(async (tx) => {
      // Create RewardEvents with skipDuplicates (idempotent - unique on refType+refId)
      await tx.rewardEvent.createMany({
        data: rewardEventData,
        skipDuplicates: true,
      });

      // Update paidAtomic on WeeklyUserStat for each user
      // Convert 6-decimal RewardEvent amounts to 9-decimal on-chain amounts
      const DECIMAL_CONVERSION = 1000n; // 10^9 / 10^6 = 1000
      for (const [userId, data] of userRewards) {
        const paidAtomic9 = data.amount * DECIMAL_CONVERSION;
        await tx.weeklyUserStat.upsert({
          where: { weekKey_userId: { weekKey: statsWeekKey!, userId } },
          create: {
            weekKey: statsWeekKey!,
            userId,
            paidAtomic: paidAtomic9,
          },
          update: {
            paidAtomic: paidAtomic9,
          },
        });
      }

      // Mark batch as DONE
      await tx.rewardBatch.update({
        where: { id: batch.id },
        data: {
          status: BatchStatus.DONE,
          merkleRoot: "pending_build_week",
          totalAmount,
          totalUsers: userRewards.size,
          finishedAt: new Date(),
        },
      });
    });

    console.log(`[weekly-distribute] Completed batch ${batch.id} for ${userRewards.size} users`);

    return NextResponse.json({
      ok: true,
      weekKey,
      statsWeekKey,
      weekIndex,
      emission: formatXess(totalEmission),
      pools: {
        likes: formatXess(likesPool),
        mvm: formatXess(mvmPool),
        comments: formatXess(commentsPool),
        referrals: formatXess(referralsPool),
      },
      subPools: {
        weeklyDiamond: formatXess(weeklyDiamondPool),
        allTime: formatXess(allTimeLikesPool),
        memberVoter: formatXess(memberVoterPool),
      },
      totalUsers: userRewards.size,
      totalRewards: rewards.length,
      totalAmount: formatXess(totalAmount),
      batchId: batch.id,
      nextStep: "Run build-week cron to create merkle tree for on-chain claims",
    });
  } catch (error) {
    console.error("[WEEKLY_DISTRIBUTE] Error:", error);

    // Mark batch as FAILED if it exists
    if (batch) {
      await db.rewardBatch.update({
        where: { id: batch.id },
        data: { status: BatchStatus.FAILED },
      }).catch(() => {}); // Ignore errors in cleanup
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message },
      { status: 500 }
    );
  }
}
