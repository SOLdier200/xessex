import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { weekKeyUTC } from "@/lib/weekKey";
import { ALL_REWARD_TYPES } from "@/lib/claimables";
import { fromHex32 } from "@/lib/merkleSha256";

export const runtime = "nodejs";

// Lazy-loaded to avoid build-time failures when env vars are not set
function getProgramId() {
  return new PublicKey(process.env.NEXT_PUBLIC_XESS_CLAIM_PROGRAM_ID!);
}

function u64LE(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

// Emission schedule (in XESS tokens, 6 decimals - same as weekly-distribute)
const EMISSION_DECIMALS = 6n;
const EMISSION_MULTIPLIER = 10n ** EMISSION_DECIMALS;

// Genesis week start date (Monday)
const GENESIS_MONDAY = new Date("2026-01-13T00:00:00Z");

function getWeekIndex(weekKey: string): number {
  const weekStart = new Date(`${weekKey}T00:00:00Z`);
  const diffMs = weekStart.getTime() - GENESIS_MONDAY.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, diffWeeks);
}

// Updated for 200M total rewards (20% of 1B supply)
function getWeeklyEmission(weekIndex: number): bigint {
  if (weekIndex < 12) return 666_667n * EMISSION_MULTIPLIER;  // Phase 1
  if (weekIndex < 39) return 500_000n * EMISSION_MULTIPLIER;  // Phase 2
  if (weekIndex < 78) return 333_333n * EMISSION_MULTIPLIER;  // Phase 3
  return 166_667n * EMISSION_MULTIPLIER;                      // Phase 4
}

// Pool splits
const LIKES_POOL_BPS = 7500n;
const COMMENTS_POOL_BPS = 500n;

// Format 9-decimal amount (on-chain)
function format9(amount: bigint): string {
  const DECIMALS = 1_000_000_000n;
  const whole = amount / DECIMALS;
  const frac = amount % DECIMALS;
  if (frac === 0n) return whole.toLocaleString();
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole.toLocaleString()}.${fracStr}`;
}

/**
 * GET /api/rewards/pending
 *
 * Returns live pending rewards for the current user:
 * - currentWeek: Current week activity and estimated rewards
 * - unclaimedWeeks: List of finalized but unclaimed weeks
 * - nextPayout: Countdown to next Monday finalization
 */
export async function GET() {
  const ctx = await getAccessContext();
  if (!ctx.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userId = ctx.user.id;
  const wallet = (ctx.user.solWallet || ctx.user.walletAddress || "").trim();
  const desiredVersion = 2; // V2 uses userId-based rewards
  const now = new Date();
  const currentWeekKey = weekKeyUTC(now);
  const weekIndex = getWeekIndex(currentWeekKey);

  // Calculate next Monday 00:00 UTC
  const nextMonday = new Date(`${currentWeekKey}T00:00:00Z`);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  const msUntilPayout = nextMonday.getTime() - now.getTime();
  const hoursUntil = Math.floor(msUntilPayout / (1000 * 60 * 60));
  const daysUntil = Math.floor(hoursUntil / 24);
  const remainingHours = hoursUntil % 24;

  // Get current week stats
  const currentStats = await db.weeklyUserStat.findUnique({
    where: { weekKey_userId: { weekKey: currentWeekKey, userId } },
  });

  // Get current week voter stats
  const currentVoterStats = await db.weeklyVoterStat.findUnique({
    where: { weekKey_userId: { weekKey: currentWeekKey, userId } },
  });

  // Estimate current week pending (rough estimate based on activity)
  const emission = getWeeklyEmission(weekIndex);
  const likesPool = (emission * LIKES_POOL_BPS) / 10000n;
  const commentsPool = (emission * COMMENTS_POOL_BPS) / 10000n;

  // Simple estimate: assume user is sole participant (max possible)
  // Real distribution happens in weekly-distribute with rankings
  let estimatedPending6 = 0n;
  let estimateNote = "";

  if (currentStats) {
    // Rough estimate: proportional share if user had similar activity to others
    // This is just for display - actual distribution uses rankings
    if (currentStats.scoreReceived > 0) {
      // Assume top 50 distribution, user gets proportional share
      estimatedPending6 += (likesPool * 8500n) / 10000n / 50n; // Rough avg for top 50
      estimateNote = "Based on current score activity";
    }
    if (currentStats.diamondComments > 0) {
      estimatedPending6 += (commentsPool * BigInt(currentStats.diamondComments)) / 10n; // Assume 10 total commenters
    }
  }

  // Convert to 9 decimals for display
  const estimatedPending9 = estimatedPending6 * 1000n;

  // Get all unclaimed weeks (finalized but not claimed)
  // A week is unclaimed if: ClaimEpoch exists with setOnChain=true AND user has ClaimLeaf
  // AND no RewardEvent.claimedAt set for that week (V2 uses userId)
  const unclaimedEpochs = await db.claimEpoch.findMany({
    where: {
      setOnChain: true,
      version: 2,
      leaves: {
        some: { userId },
      },
    },
    include: {
      leaves: {
        where: { userId },
        select: { amountAtomic: true, userKeyHex: true },
      },
    },
    orderBy: { epoch: "desc" },
  });

  // Filter to only truly unclaimed (check DB and on-chain receipt)
  const unclaimedWeeks: Array<{
    epoch: number;
    weekKey: string;
    amount: string;
    amountAtomic: string;
  }> = [];

  // Setup Solana connection for on-chain receipt checks
  const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");

  for (const epochRow of unclaimedEpochs) {
    const leaf = epochRow.leaves[0];
    if (!leaf) continue;

    // First check DB for claimed status
    const claimedReward = await db.rewardEvent.findFirst({
      where: {
        userId,
        weekKey: epochRow.weekKey,
        claimedAt: { not: null },
        type: { in: ALL_REWARD_TYPES },
      },
    });

    if (claimedReward) {
      // Already claimed in DB - skip
      continue;
    }

    // Also check on-chain receipt (in case DB wasn't updated after claim)
    if (leaf.userKeyHex) {
      try {
        const epochBigInt = BigInt(epochRow.epoch);
        const [receiptV2Pda] = PublicKey.findProgramAddressSync(
          [Buffer.from("receipt_v2"), u64LE(epochBigInt), fromHex32(leaf.userKeyHex)],
          getProgramId()
        );

        const receiptInfo = await connection.getAccountInfo(receiptV2Pda);
        if (receiptInfo && receiptInfo.owner.equals(getProgramId())) {
          console.log(`[rewards/pending] Epoch ${epochRow.epoch} already claimed on-chain, syncing DB`);
          // Sync DB: mark rewards as claimed since on-chain receipt exists
          await db.rewardEvent.updateMany({
            where: {
              userId,
              weekKey: epochRow.weekKey,
              claimedAt: null,
              type: { in: ALL_REWARD_TYPES },
            },
            data: { claimedAt: new Date() },
          });
          continue;
        }
      } catch (err) {
        console.error(`[rewards/pending] Error checking on-chain receipt for epoch ${epochRow.epoch}:`, err);
      }
    }

    // This week is truly unclaimed
    unclaimedWeeks.push({
      epoch: epochRow.epoch,
      weekKey: epochRow.weekKey,
      amount: format9(leaf.amountAtomic),
      amountAtomic: leaf.amountAtomic.toString(),
    });
  }

  // Total unclaimed
  const totalUnclaimedAtomic = unclaimedWeeks.reduce(
    (sum, w) => sum + BigInt(w.amountAtomic),
    0n
  );

  return NextResponse.json({
    ok: true,
    currentWeek: {
      weekKey: currentWeekKey,
      weekIndex,
      activity: {
        scoreReceived: currentStats?.scoreReceived ?? 0,
        diamondComments: currentStats?.diamondComments ?? 0,
        mvmPoints: currentStats?.mvmPoints ?? 0,
        votesCast: currentVoterStats?.votesCast ?? 0,
      },
      pendingAtomic: currentStats?.pendingAtomic?.toString() ?? "0",
      estimatedPending: format9(estimatedPending9),
      estimatedPendingAtomic: estimatedPending9.toString(),
      estimateNote: estimateNote || "Estimate based on current activity",
    },
    nextPayout: {
      date: nextMonday.toISOString(),
      countdown: `${daysUntil}d ${remainingHours}h`,
      msRemaining: msUntilPayout,
    },
    unclaimedWeeks,
    totalUnclaimed: format9(totalUnclaimedAtomic),
    totalUnclaimedAtomic: totalUnclaimedAtomic.toString(),
    hasWallet: !!wallet,
  });
}
