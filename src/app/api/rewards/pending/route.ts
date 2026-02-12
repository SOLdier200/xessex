import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { weekKeyUTC, weekKeySundayMidnightPT, getPayoutPeriod } from "@/lib/weekKey";
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
  const wallet = ctx.user.walletAddress || "".trim();
  const desiredVersion = 2; // V2 uses wallet-based rewards
  const now = new Date();
  const currentWeekKey = weekKeyUTC(now);
  const weekIndex = getWeekIndex(currentWeekKey);

  // Calculate next payout time (twice-weekly: Wed evening PT for P1, Sat evening PT for P2)
  // Get current PT day of week
  const ptParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const ptDayName = ptParts.find(p => p.type === "weekday")?.value ?? "Mon";
  const ptHour = parseInt(ptParts.find(p => p.type === "hour")?.value ?? "0", 10);
  const ptDowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const ptDow = ptDowMap[ptDayName] ?? 1;

  // P1 pays out Wednesday ~midnight PT (23:59), P2 pays out Saturday ~midnight PT (23:59)
  let daysUntilPayout: number;
  let payoutLabel: string;
  const period = getPayoutPeriod(now);

  if (period === 1) {
    // Sun-Wed → target = Wednesday 23:59 PT
    daysUntilPayout = 3 - ptDow; // Wed(3) - current
    if (daysUntilPayout < 0 || (daysUntilPayout === 0 && ptHour >= 23)) {
      // Past Wed evening → next payout is Saturday
      daysUntilPayout = 6 - ptDow;
      payoutLabel = "Saturday evening PT";
    } else {
      payoutLabel = "Wednesday evening PT";
    }
  } else {
    // Thu-Sat → target = Saturday 23:59 PT
    daysUntilPayout = 6 - ptDow; // Sat(6) - current
    if (daysUntilPayout < 0 || (daysUntilPayout === 0 && ptHour >= 23)) {
      // Past Sat evening → next payout is Wednesday (4 days from Sun)
      daysUntilPayout = 3 + (7 - ptDow);
      payoutLabel = "Wednesday evening PT";
    } else {
      payoutLabel = "Saturday evening PT";
    }
  }

  if (daysUntilPayout < 0) daysUntilPayout = 0;
  const msUntilPayout = daysUntilPayout * 24 * 60 * 60 * 1000;
  const hoursUntil = daysUntilPayout * 24;
  const daysUntil = daysUntilPayout;
  const remainingHours = 0;

  // Get current week stats per pool and aggregate
  const allUserStats = await db.weeklyUserStat.findMany({
    where: { weekKey: currentWeekKey, userId },
  });
  const allVoterStats = await db.weeklyVoterStat.findMany({
    where: { weekKey: currentWeekKey, userId },
  });

  // Aggregate across pools
  const embedUserStat = allUserStats.find(s => s.pool === "EMBED");
  const xessexUserStat = allUserStats.find(s => s.pool === "XESSEX");
  const embedVoterStat = allVoterStats.find(s => s.pool === "EMBED");
  const xessexVoterStat = allVoterStats.find(s => s.pool === "XESSEX");

  const totalScoreReceived = allUserStats.reduce((s, r) => s + r.scoreReceived, 0);
  const totalDiamondComments = allUserStats.reduce((s, r) => s + r.diamondComments, 0);
  const totalMvmPoints = allUserStats.reduce((s, r) => s + r.mvmPoints, 0);
  const totalVotesCast = allVoterStats.reduce((s, r) => s + r.votesCast, 0);

  // Count ratings and 5-star ratings this week (from VideoStarRating)
  const weekStart = new Date(`${currentWeekKey}T00:00:00Z`);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [totalRatings, fiveStarRatings] = await Promise.all([
    db.videoStarRating.count({
      where: { userId, createdAt: { gte: weekStart, lt: weekEnd } },
    }),
    db.videoStarRating.count({
      where: { userId, createdAt: { gte: weekStart, lt: weekEnd }, stars: 5 },
    }),
  ]);

  // Count ratings by pool (join through video.kind)
  const ratingsByPool = await db.videoStarRating.findMany({
    where: { userId, createdAt: { gte: weekStart, lt: weekEnd } },
    select: { stars: true, video: { select: { kind: true } } },
  });
  const xessexRatings = ratingsByPool.filter(r => r.video.kind === "XESSEX").length;
  const xessexFiveStarRatings = ratingsByPool.filter(r => r.video.kind === "XESSEX" && r.stars === 5).length;

  // Compat: keep a "currentStats" shape for the estimate logic below
  const currentStats = allUserStats.length > 0
    ? { scoreReceived: totalScoreReceived, diamondComments: totalDiamondComments, mvmPoints: totalMvmPoints }
    : null;

  // Check for actual PAID RewardEvents for this week's periods (P1 and P2)
  // RewardEvent.weekKey stores periodKey like "2026-02-02-P1"
  const sundayKey = weekKeySundayMidnightPT(now);
  const actualRewards = await db.rewardEvent.findMany({
    where: {
      userId,
      weekKey: { startsWith: sundayKey },
      status: "PAID",
      type: { in: ALL_REWARD_TYPES },
    },
    select: { amount: true, claimedAt: true },
  });

  // Sum actual rewards (6 decimals) — both claimed and unclaimed
  const actualTotal6 = actualRewards.reduce((sum, r) => sum + r.amount, 0n);
  // Sum only unclaimed rewards
  const actualUnclaimed6 = actualRewards.filter(r => !r.claimedAt).reduce((sum, r) => sum + r.amount, 0n);

  let estimatedPending9: bigint;
  let estimateNote = "";
  let isActualPayout = false;

  if (actualTotal6 > 0n) {
    // Real payout data exists — show actual unclaimed amount (not a rough guess)
    estimatedPending9 = actualUnclaimed6 * 1000n; // convert 6→9 decimals
    isActualPayout = true;
    estimateNote = actualUnclaimed6 === 0n
      ? "All rewards for this week have been claimed"
      : "Based on actual payout calculation";
  } else {
    // No payout yet — fall back to rough estimate
    const emission = getWeeklyEmission(weekIndex);
    const likesPool = (emission * LIKES_POOL_BPS) / 10000n;
    const commentsPool = (emission * COMMENTS_POOL_BPS) / 10000n;

    let estimatedPending6 = 0n;

    if (currentStats) {
      if (currentStats.scoreReceived > 0) {
        estimatedPending6 += (likesPool * 8500n) / 10000n / 50n;
        estimateNote = "Based on current score activity";
      }
      if (currentStats.diamondComments > 0) {
        estimatedPending6 += (commentsPool * BigInt(currentStats.diamondComments)) / 10n;
      }
    }

    estimatedPending9 = estimatedPending6 * 1000n;
    if (!estimateNote) estimateNote = "Estimate based on current activity";
  }

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

    // Check if rewards for this epoch's weekKey are already claimed in DB
    // For test epochs (no matching RewardEvents), we still show as claimable
    const claimedRewardForEpoch = await db.rewardEvent.findFirst({
      where: {
        userId,
        weekKey: epochRow.weekKey,
        claimedAt: { not: null },
        type: { in: ALL_REWARD_TYPES },
      },
    });

    if (claimedRewardForEpoch) {
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
          // Sync DB: mark only THIS epoch's weekKey rewards as claimed
          const synced = await db.rewardEvent.updateMany({
            where: {
              userId,
              weekKey: epochRow.weekKey,
              status: "PAID",
              claimedAt: null,
              type: { in: ALL_REWARD_TYPES },
            },
            data: { claimedAt: new Date(), txSig: "synced-from-onchain" },
          });
          if (synced.count > 0) {
            console.log(`[rewards/pending] Epoch ${epochRow.epoch} (${epochRow.weekKey}) already claimed on-chain, synced ${synced.count} reward rows`);
          }
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
        scoreReceived: totalScoreReceived,
        diamondComments: totalDiamondComments,
        mvmPoints: totalMvmPoints,
        votesCast: totalVotesCast,
        totalRatings,
        fiveStarRatings,
        // Per-pool breakdown
        embed: {
          scoreReceived: embedUserStat?.scoreReceived ?? 0,
          diamondComments: embedUserStat?.diamondComments ?? 0,
          mvmPoints: embedUserStat?.mvmPoints ?? 0,
          votesCast: embedVoterStat?.votesCast ?? 0,
        },
        xessex: {
          scoreReceived: xessexUserStat?.scoreReceived ?? 0,
          diamondComments: xessexUserStat?.diamondComments ?? 0,
          mvmPoints: xessexUserStat?.mvmPoints ?? 0,
          votesCast: xessexVoterStat?.votesCast ?? 0,
          ratings: xessexRatings,
          fiveStarRatings: xessexFiveStarRatings,
        },
      },
      estimatedPending: format9(estimatedPending9),
      estimatedPendingAtomic: estimatedPending9.toString(),
      estimateNote,
      isActualPayout,
    },
    nextPayout: {
      date: new Date(now.getTime() + msUntilPayout).toISOString(),
      countdown: daysUntil > 0 ? `${daysUntil}d` : "Today",
      label: payoutLabel,
      msRemaining: msUntilPayout,
    },
    unclaimedWeeks,
    totalUnclaimed: format9(totalUnclaimedAtomic),
    totalUnclaimedAtomic: totalUnclaimedAtomic.toString(),
    hasWallet: !!wallet,
  });
}
