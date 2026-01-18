import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { monthKeyUTC } from "@/lib/weekKey";
import { getAdminConfig } from "@/lib/adminConfig";
import { keccak256, encodePacked } from "viem";
import { SubscriptionTier, SubscriptionStatus, Prisma } from "@prisma/client";

// Verify cron secret
const CRON_SECRET = process.env.CRON_SECRET || "";

// Emission schedule (in XESS tokens, 6 decimals)
// IMPORTANT: RewardEvent.amount is stored with 6 decimals.
// The claimables aggregator converts to 9 decimals for on-chain use.
// See: src/lib/claimables.ts for conversion logic.
const EMISSION_DECIMALS = 6n;
const EMISSION_MULTIPLIER = 10n ** EMISSION_DECIMALS;

function getWeeklyEmission(weekIndex: number): bigint {
  if (weekIndex < 12) return 1_000_000n * EMISSION_MULTIPLIER;
  if (weekIndex < 39) return 750_000n * EMISSION_MULTIPLIER;
  if (weekIndex < 78) return 500_000n * EMISSION_MULTIPLIER;
  return 250_000n * EMISSION_MULTIPLIER;
}

// Pool split percentages (in basis points, 10000 = 100%)
const LIKES_POOL_BPS = 7500n;    // 75%
const MVM_POOL_BPS = 2000n;      // 20%
const COMMENTS_POOL_BPS = 500n;  // 5%

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
  walletAddress: string;
  amount: bigint;
  type: "WEEKLY_LIKES" | "WEEKLY_MVM" | "WEEKLY_COMMENTS" | "WEEKLY_VOTER" | "ALLTIME_LIKES";
}

function formatXess(amount: bigint): string {
  const whole = amount / EMISSION_MULTIPLIER;
  const frac = amount % EMISSION_MULTIPLIER;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

/**
 * Eligibility filter for Diamond payouts:
 * - Subscription.tier = DIAMOND
 * - Subscription.status = ACTIVE
 * - Subscription.expiresAt is null OR in the future
 * - User.solWallet is not null
 */
function eligibleDiamondUserWhere(now: Date): Prisma.UserWhereInput {
  return {
    solWallet: { not: null },
    subscription: {
      is: {
        tier: SubscriptionTier.DIAMOND,
        status: SubscriptionStatus.ACTIVE,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
    },
  };
}

/**
 * Get top 50 users by weekly scoreReceived (Diamond only)
 */
async function getTop50Score(weekKey: string, minThreshold: number, now: Date): Promise<Winner[]> {
  const top50 = await db.weeklyUserStat.findMany({
    where: {
      weekKey,
      scoreReceived: { gte: minThreshold },
      user: eligibleDiamondUserWhere(now),
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
  const weekKey = searchParams.get("weekKey");
  const weekIndexStr = searchParams.get("weekIndex");

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

  // Check if already processed
  const existingBatch = await db.rewardBatch.findUnique({ where: { weekKey } });
  if (existingBatch) {
    return NextResponse.json(
      { ok: false, error: "ALREADY_PROCESSED", weekKey },
      { status: 409 }
    );
  }

  const now = new Date();

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

    // Likes pool sub-pools
    const weeklyDiamondPool = (likesPool * weeklyDiamondBps) / 10000n;
    const allTimeLikesPool = (likesPool * allTimeLikesBps) / 10000n;
    const memberVoterPool = (likesPool * memberVoterBps) / 10000n;

    console.log(`[weekly-distribute] Week ${weekKey} (index ${weekIndex})`);
    console.log(`[weekly-distribute] Emission: ${formatXess(totalEmission)} XESS`);
    console.log(`[weekly-distribute] Pools - Likes: ${formatXess(likesPool)}, MVM: ${formatXess(mvmPool)}, Comments: ${formatXess(commentsPool)}`);
    console.log(`[weekly-distribute] Likes sub-pools - Weekly: ${formatXess(weeklyDiamondPool)}, AllTime: ${formatXess(allTimeLikesPool)}, Voter: ${formatXess(memberVoterPool)}`);

    const rewards: UserReward[] = [];

    // 1. Weekly Diamond Score (top 50 by scoreReceived) - Diamond only
    console.log(`\n[weekly-distribute] === WEEKLY SCORE REWARDS (Top 50, >= ${minWeeklyScoreThreshold} score) ===`);
    const top50 = await getTop50Score(weekKey, minWeeklyScoreThreshold, now);
    const sumScore = top50.reduce((acc, w) => acc + w.score, 0);

    console.log(`[weekly-distribute] Found ${top50.length} eligible Diamond users with >= ${minWeeklyScoreThreshold} weekly score`);
    console.log(`[weekly-distribute] Total weekly score in top 50: ${sumScore}`);

    if (top50.length > 0) {
      const basePool = (weeklyDiamondPool * 80n) / 100n;  // 80% proportional
      const ladderPool = (weeklyDiamondPool * 20n) / 100n; // 20% ladder

      // Get wallet addresses for winners
      const userIds = top50.map(w => w.userId);
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, solWallet: true },
      });
      const walletMap = new Map(users.map(u => [u.id, u.solWallet]));

      for (let i = 0; i < top50.length; i++) {
        const w = top50[i];
        const wallet = walletMap.get(w.userId);
        if (!wallet) continue;

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

    // 2. All-Time Likes (top 50 by all-time scoreReceived) - Diamond only
    console.log(`\n[weekly-distribute] === ALL-TIME SCORE REWARDS ===`);
    const allTimeStats = await db.allTimeUserStat.findMany({
      where: {
        scoreReceived: { gt: 0 },
        user: eligibleDiamondUserWhere(now),
      },
      orderBy: { scoreReceived: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, solWallet: true } },
      },
    });

    if (allTimeStats.length > 0 && allTimeLikesPool > 0n) {
      const totalAllTimeScore = allTimeStats.reduce((sum, s) => sum + s.scoreReceived, 0);
      const basePool = (allTimeLikesPool * 80n) / 100n;
      const ladderPool = (allTimeLikesPool * 20n) / 100n;

      console.log(`[weekly-distribute] All-time top ${allTimeStats.length} eligible Diamond users, total score: ${totalAllTimeScore}`);

      for (let i = 0; i < allTimeStats.length; i++) {
        const stat = allTimeStats[i];
        if (!stat.user.solWallet) continue;

        const baseReward = totalAllTimeScore > 0
          ? (basePool * BigInt(stat.scoreReceived)) / BigInt(totalAllTimeScore)
          : 0n;

        const ladderPercent = LADDER_PERCENTS[i] || 0;
        const ladderReward = (ladderPool * BigInt(Math.round(ladderPercent * 1000))) / 100000n;

        const totalReward = baseReward + ladderReward;
        if (totalReward > 0n) {
          rewards.push({
            userId: stat.userId,
            walletAddress: stat.user.solWallet,
            amount: totalReward,
            type: "ALLTIME_LIKES",
          });
        }
      }
    } else {
      console.log(`[weekly-distribute] No eligible users for all-time rewards or pool is 0`);
    }

    // 3. Member Voter Rewards (proportional to votes cast) - wallet linked only (any tier)
    console.log(`\n[weekly-distribute] === MEMBER VOTER REWARDS ===`);
    const voterStats = await db.weeklyVoterStat.findMany({
      where: {
        weekKey,
        votesCast: { gt: 0 },
        user: { solWallet: { not: null } },
      },
      include: {
        user: { select: { id: true, solWallet: true } },
      },
    });

    if (voterStats.length > 0 && memberVoterPool > 0n) {
      const totalVotes = voterStats.reduce((sum, s) => sum + s.votesCast, 0);
      console.log(`[weekly-distribute] Voter rewards: ${voterStats.length} voters with linked wallets, ${totalVotes} total votes`);

      for (const stat of voterStats) {
        if (!stat.user.solWallet) continue;
        const reward = (memberVoterPool * BigInt(stat.votesCast)) / BigInt(totalVotes);
        if (reward > 0n) {
          rewards.push({
            userId: stat.userId,
            walletAddress: stat.user.solWallet,
            amount: reward,
            type: "WEEKLY_VOTER",
          });
        }
      }
    } else {
      console.log(`[weekly-distribute] No voters with linked wallets or pool is 0`);
    }

    // 4. MVM Pool (monthly stats, weekly payout) - Diamond only
    console.log(`\n[weekly-distribute] === MVM REWARDS (Monthly ranking) ===`);
    const monthKey = monthKeyUTC(new Date(weekKey));
    const mvmStats = await db.monthlyUserStat.findMany({
      where: {
        monthKey,
        mvmPoints: { gte: minMvmThreshold },
        user: eligibleDiamondUserWhere(now),
      },
      orderBy: { mvmPoints: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, solWallet: true } },
      },
    });

    // Check if ANY MVM points exist this month (skip payout if 0)
    const totalMonthMvm = mvmStats.reduce((sum, s) => sum + s.mvmPoints, 0);
    if (totalMonthMvm === 0) {
      console.log(`[weekly-distribute] No MVM points this month - skipping MVM payout (withheld to treasury)`);
    } else if (mvmStats.length > 0) {
      const basePool = (mvmPool * 80n) / 100n;
      const ladderPool = (mvmPool * 20n) / 100n;

      console.log(`[weekly-distribute] MVM rewards: ${mvmStats.length} eligible Diamond users, ${totalMonthMvm} total MVM points`);

      for (let i = 0; i < mvmStats.length; i++) {
        const stat = mvmStats[i];
        if (!stat.user.solWallet) continue;

        const baseReward = totalMonthMvm > 0
          ? (basePool * BigInt(stat.mvmPoints)) / BigInt(totalMonthMvm)
          : 0n;

        const ladderPercent = LADDER_PERCENTS[i] || 0;
        const ladderReward = (ladderPool * BigInt(Math.round(ladderPercent * 1000))) / 100000n;

        const totalReward = baseReward + ladderReward;
        if (totalReward > 0n) {
          rewards.push({
            userId: stat.userId,
            walletAddress: stat.user.solWallet,
            amount: totalReward,
            type: "WEEKLY_MVM",
          });
        }
      }
    } else {
      console.log(`[weekly-distribute] No eligible Diamond users for MVM rewards`);
    }

    // 5. Comments Pool (Diamond users proportional to diamondComments)
    console.log(`\n[weekly-distribute] === COMMENTS REWARDS ===`);
    const commentStats = await db.weeklyUserStat.findMany({
      where: {
        weekKey,
        diamondComments: { gt: 0 },
        user: eligibleDiamondUserWhere(now),
      },
      include: {
        user: { select: { id: true, solWallet: true } },
      },
    });

    if (commentStats.length > 0) {
      const totalComments = commentStats.reduce((sum, s) => sum + s.diamondComments, 0);
      console.log(`[weekly-distribute] Comments rewards: ${commentStats.length} eligible Diamond commenters, ${totalComments} total comments`);

      for (const stat of commentStats) {
        if (!stat.user.solWallet) continue;
        const reward = (commentsPool * BigInt(stat.diamondComments)) / BigInt(totalComments);
        if (reward > 0n) {
          rewards.push({
            userId: stat.userId,
            walletAddress: stat.user.solWallet,
            amount: reward,
            type: "WEEKLY_COMMENTS",
          });
        }
      }
    } else {
      console.log(`[weekly-distribute] No eligible Diamond commenters`);
    }

    // Aggregate rewards by user (combine multiple reward types)
    const userRewards = new Map<string, { amount: bigint; wallet: string; types: Set<string> }>();
    for (const r of rewards) {
      const existing = userRewards.get(r.userId);
      if (existing) {
        existing.amount += r.amount;
        existing.types.add(r.type);
      } else {
        userRewards.set(r.userId, {
          amount: r.amount,
          wallet: r.walletAddress,
          types: new Set([r.type]),
        });
      }
    }

    console.log(`\n[weekly-distribute] Total rewards: ${rewards.length}, unique users: ${userRewards.size}`);

    // Build merkle tree
    const leaves: { userId: string; wallet: string; amount: bigint; hash: `0x${string}` }[] = [];
    let index = 0;
    for (const [userId, data] of userRewards) {
      const leaf = keccak256(
        encodePacked(
          ["uint256", "address", "uint256"],
          [BigInt(index), data.wallet as `0x${string}`, data.amount]
        )
      );
      leaves.push({ userId, wallet: data.wallet, amount: data.amount, hash: leaf });
      index++;
    }

    // Simple merkle root calculation
    const merkleRoot = leaves.length > 0
      ? calculateMerkleRoot(leaves.map(l => l.hash))
      : "0x0000000000000000000000000000000000000000000000000000000000000000";

    // Generate proofs for each leaf
    const proofs = generateMerkleProofs(leaves.map(l => l.hash));

    // Create RewardBatch and RewardEvents in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create batch
      const batch = await tx.rewardBatch.create({
        data: {
          weekKey,
          merkleRoot,
          totalAmount: Array.from(userRewards.values()).reduce((sum, r) => sum + r.amount, 0n),
          totalUsers: userRewards.size,
        },
      });

      // Create individual RewardEvents
      let eventIndex = 0;
      for (const reward of rewards) {
        // Use distinct refType for score-based rewards
        const refType = reward.type === "WEEKLY_LIKES" ? "weekly_score" : `weekly_${reward.type.toLowerCase()}`;
        const refId = `${weekKey}:${reward.userId}:${refType}`;
        const proof = proofs[eventIndex] || [];

        await tx.rewardEvent.create({
          data: {
            userId: reward.userId,
            type: reward.type,
            amount: reward.amount,
            status: "PENDING",
            weekKey,
            refType,
            refId,
            merkleIndex: eventIndex,
            merkleProof: JSON.stringify(proof),
          },
        });
        eventIndex++;
      }

      return batch;
    });

    console.log(`[weekly-distribute] Created batch ${result.id} with merkle root ${merkleRoot}`);

    return NextResponse.json({
      ok: true,
      weekKey,
      weekIndex,
      emission: formatXess(totalEmission),
      pools: {
        likes: formatXess(likesPool),
        mvm: formatXess(mvmPool),
        comments: formatXess(commentsPool),
      },
      subPools: {
        weeklyDiamond: formatXess(weeklyDiamondPool),
        allTime: formatXess(allTimeLikesPool),
        memberVoter: formatXess(memberVoterPool),
      },
      totalUsers: userRewards.size,
      totalRewards: rewards.length,
      merkleRoot,
      batchId: result.id,
    });
  } catch (error) {
    console.error("[WEEKLY_DISTRIBUTE] Error:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// Simple merkle root calculation
function calculateMerkleRoot(hashes: `0x${string}`[]): string {
  if (hashes.length === 0) return "0x" + "0".repeat(64);
  if (hashes.length === 1) return hashes[0];

  const nextLevel: `0x${string}`[] = [];
  for (let i = 0; i < hashes.length; i += 2) {
    const left = hashes[i];
    const right = hashes[i + 1] || hashes[i]; // Duplicate last if odd
    const combined = left < right
      ? keccak256(encodePacked(["bytes32", "bytes32"], [left, right]))
      : keccak256(encodePacked(["bytes32", "bytes32"], [right, left]));
    nextLevel.push(combined);
  }

  return calculateMerkleRoot(nextLevel);
}

// Generate merkle proofs for all leaves
function generateMerkleProofs(hashes: `0x${string}`[]): `0x${string}`[][] {
  if (hashes.length <= 1) return hashes.map(() => []);

  const proofs: `0x${string}`[][] = hashes.map(() => []);
  let currentLevel = [...hashes];
  let indices = hashes.map((_, i) => i);

  while (currentLevel.length > 1) {
    const nextLevel: `0x${string}`[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] || currentLevel[i];

      // Add sibling to proof for both leaves in this pair
      for (let j = 0; j < indices.length; j++) {
        const originalIdx = indices[j];
        if (Math.floor(originalIdx / 2) === Math.floor(i / 2)) {
          if (originalIdx % 2 === 0 && i + 1 < currentLevel.length) {
            proofs[j].push(right);
          } else if (originalIdx % 2 === 1) {
            proofs[j].push(left);
          } else if (i + 1 >= currentLevel.length) {
            proofs[j].push(left);
          }
        }
      }

      const combined = left < right
        ? keccak256(encodePacked(["bytes32", "bytes32"], [left, right]))
        : keccak256(encodePacked(["bytes32", "bytes32"], [right, left]));
      nextLevel.push(combined);
    }

    // Update indices for next level
    for (let j = 0; j < indices.length; j++) {
      indices[j] = Math.floor(indices[j] / 2);
    }

    currentLevel = nextLevel;
  }

  return proofs;
}
