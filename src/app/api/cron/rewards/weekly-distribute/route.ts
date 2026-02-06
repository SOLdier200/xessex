// src/app/api/cron/rewards/weekly-distribute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { monthKeyUTC, parsePeriodKey } from "@/lib/weekKey";
import { getAdminConfig } from "@/lib/adminConfig";
import { Prisma, BatchStatus } from "@prisma/client";

// Stale batch threshold (30 minutes) - RUNNING batches older than this can be force-reset
const STALE_BATCH_MS = 30 * 60 * 1000;

// Verify cron secret
const CRON_SECRET = process.env.CRON_SECRET || "";

// RewardEvent.amount is stored with 6 decimals (same as your current file)
const EMISSION_DECIMALS = 6n;
const EMISSION_MULTIPLIER = 10n ** EMISSION_DECIMALS;

// Existing emission schedule (returns FULL weekly amount)
function getWeeklyEmission(weekIndex: number): bigint {
  if (weekIndex < 12) return 666_667n * EMISSION_MULTIPLIER;
  if (weekIndex < 39) return 500_000n * EMISSION_MULTIPLIER;
  if (weekIndex < 78) return 333_333n * EMISSION_MULTIPLIER;
  return 166_667n * EMISSION_MULTIPLIER;
}

// For twice-weekly payouts, each period gets half the weekly emission
function getPeriodEmission(weekIndex: number): bigint {
  return getWeeklyEmission(weekIndex) / 2n;
}

// Leaderboard sub-pool splits (unchanged)
const LIKES_POOL_BPS = 7000n; // 70%
const MVM_POOL_BPS = 2000n; // 20%
const COMMENTS_POOL_BPS = 500n; // 5%
const REFERRALS_POOL_BPS = 500n; // 5%

// Referral tiers (unchanged)
const REF_L1_BPS = 1000n; // 10%
const REF_L2_BPS = 300n; // 3%
const REF_L3_BPS = 100n; // 1%

// Ladder percentages for top 50 (unchanged)
const LADDER_PERCENTS: number[] = [
  20, // Rank 1
  12, // Rank 2
  8, // Rank 3
  5, 5, 5, 5, 5, 5, 5, // Ranks 4-10
  ...Array(40).fill(0.625), // Ranks 11-50
];

type Pool = "EMBED" | "XESSEX";
type Winner = { userId: string; score: number };

interface UserReward {
  userId: string;
  walletAddress: string | null;
  amount: bigint;
  type:
    | "WEEKLY_LIKES"
    | "WEEKLY_MVM"
    | "WEEKLY_COMMENTS"
    | "WEEKLY_VOTER"
    | "ALLTIME_LIKES"
    | "REF_L1"
    | "REF_L2"
    | "REF_L3";
  referralFromUserId?: string | null;
  refType: string; // IMPORTANT: we encode pool + meaning here (flat/leaderboard)
}

function formatXess(amount: bigint): string {
  const whole = amount / EMISSION_MULTIPLIER;
  const frac = amount % EMISSION_MULTIPLIER;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

function parseWeekKeyUTC(weekKey: string): Date {
  // weekKey: "YYYY-MM-DD"
  const [y, m, d] = weekKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Eligibility filter: must have walletAddress, not reward-banned, not global-banned.
 * Expired temp bans are included (auto-lift).
 */
function eligibleUserWhere(): Prisma.UserWhereInput {
  return {
    walletAddress: { not: null },
    OR: [
      { rewardBanStatus: { in: ["ALLOWED", "WARNED", "UNBANNED"] } },
      { rewardBanStatus: "TEMP_BANNED", rewardBanUntil: { lt: new Date() } },
    ],
    globalBanStatus: { in: ["ALLOWED", "WARNED", "UNBANNED"] },
  };
}

/**
 * Referral chain (unchanged from your current file)
 */
async function getReferralChain(
  userId: string
): Promise<{ id: string; wallet: string }[]> {
  const chain: { id: string; wallet: string }[] = [];

  const u1 = await db.user.findUnique({
    where: { id: userId },
    select: { referredById: true },
  });
  if (!u1?.referredById) return chain;

  const l1User = await db.user.findUnique({
    where: { id: u1.referredById },
    select: { id: true, walletAddress: true, referredById: true },
  });
  if (l1User?.walletAddress) chain.push({ id: l1User.id, wallet: l1User.walletAddress });

  if (!l1User?.referredById) return chain;

  const l2User = await db.user.findUnique({
    where: { id: l1User.referredById },
    select: { id: true, walletAddress: true, referredById: true },
  });
  if (l2User?.walletAddress) chain.push({ id: l2User.id, wallet: l2User.walletAddress });

  if (!l2User?.referredById) return chain;

  const l3User = await db.user.findUnique({
    where: { id: l2User.referredById },
    select: { id: true, walletAddress: true },
  });
  if (l3User?.walletAddress) chain.push({ id: l3User.id, wallet: l3User.walletAddress });

  return chain;
}

/**
 * NOTE: This file assumes you added pool-aware stats:
 * - WeeklyUserStat: @@unique([weekKey,userId,pool]) + field pool
 * - WeeklyVoterStat: @@unique([weekKey,userId,pool]) + field pool
 * - MonthlyUserStat: @@unique([monthKey,userId,pool]) + field pool
 * - AllTimeUserStat: @@unique([userId,pool]) + field pool
 *
 * And you added:
 * - UserDailyActive(userId, day, pool) unique
 * - FlatActionLedger(weekKey, pool, refId unique) with amount in 6 decimals
 *
 * If you haven't migrated those yet, do that first—this cron relies on them.
 */

async function getTop50WeeklyScore(
  statsWeekKey: string,
  pool: Pool,
  minThreshold: number
): Promise<Winner[]> {
  const top50 = await db.weeklyUserStat.findMany({
    where: {
      weekKey: statsWeekKey,
      pool,
      scoreReceived: { gte: minThreshold },
      user: eligibleUserWhere(),
    },
    orderBy: { scoreReceived: "desc" },
    take: 50,
    select: { userId: true, scoreReceived: true },
  });

  return top50.map((r) => ({ userId: r.userId, score: r.scoreReceived }));
}

async function getActiveEverydayUserIds(
  statsWeekKey: string,
  pool: Pool
): Promise<string[]> {
  const start = parseWeekKeyUTC(statsWeekKey);
  const endExclusive = new Date(start.getTime() + 7 * 86400000);

  const grouped = await db.userDailyActive.groupBy({
    by: ["userId"],
    where: {
      pool,
      day: { gte: start, lt: endExclusive },
    },
    _count: { userId: true },
  });

  // Each row is normalized start-of-day, so count==7 means active all 7 days
  return grouped.filter((g) => g._count.userId === 7).map((g) => g.userId);
}

function applyFlatCaps(pool: Pool, byUser: Map<string, bigint>, cap: bigint) {
  let totalAfterCaps = 0n;
  const cappedByUser = new Map<string, bigint>();

  for (const [userId, amt] of byUser.entries()) {
    const clipped = amt > cap ? cap : amt;
    if (clipped > 0n) cappedByUser.set(userId, clipped);
    totalAfterCaps += clipped;
  }

  return { cappedByUser, totalAfterCaps };
}

function scaleDownIfOverBudget(byUser: Map<string, bigint>, budget: bigint) {
  const total = Array.from(byUser.values()).reduce((a, b) => a + b, 0n);
  if (total <= budget) return { scaledByUser: byUser, totalPaid: total, scalePpm: 1_000_000n };

  const scalePpm = (budget * 1_000_000n) / total;
  const scaled = new Map<string, bigint>();
  let paid = 0n;

  for (const [userId, amt] of byUser.entries()) {
    const v = (amt * scalePpm) / 1_000_000n;
    if (v > 0n) scaled.set(userId, v);
    paid += v;
  }

  return { scaledByUser: scaled, totalPaid: paid, scalePpm };
}

async function computeFlatForPool(statsWeekKey: string, pool: Pool, weeklyActiveBonusAtomic: bigint) {
  // FlatActionLedger already contains rating/comment/like_received/comment_sourced entries.
  const rows = await db.flatActionLedger.findMany({
    where: { weekKey: statsWeekKey, pool },
    select: { userId: true, amount: true },
  });

  const byUser = new Map<string, bigint>();
  for (const r of rows) {
    byUser.set(r.userId, (byUser.get(r.userId) || 0n) + r.amount);
  }

  // Weekly active bonus (computed from UserDailyActive)
  const activeUserIds = await getActiveEverydayUserIds(statsWeekKey, pool);
  for (const userId of activeUserIds) {
    byUser.set(userId, (byUser.get(userId) || 0n) + weeklyActiveBonusAtomic);
  }

  return { byUser, flatLedgerRows: rows.length, activeUserIds };
}

function poolPrefix(pool: Pool) {
  return pool === "XESSEX" ? "xessex" : "embed";
}

/**
 * POST /api/cron/rewards/weekly-distribute
 *
 * Query params:
 * - periodKey: payout period ("YYYY-MM-DD-P1" or "YYYY-MM-DD-P2") - NEW twice-weekly format
 * - weekKey: (DEPRECATED) payout week ("YYYY-MM-DD") - falls back to P1 for backwards compat
 * - statsWeekKey: optional stats source week (defaults to week portion of periodKey)
 * - weekIndex: 0-based emission week index
 * - force: 1|true to rerun if safe
 *
 * Twice-weekly payout periods:
 * - P1 (Period 1): Sunday-Wednesday, paid out Wednesday evening
 * - P2 (Period 2): Thursday-Saturday, paid out Saturday evening
 * Each period emits half the weekly allocation.
 */
export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || authHeader !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  // Support both new periodKey and legacy weekKey formats
  let periodKey = searchParams.get("periodKey");
  const legacyWeekKey = searchParams.get("weekKey");

  // If no periodKey but weekKey is provided, treat as P1 for backwards compatibility
  if (!periodKey && legacyWeekKey) {
    periodKey = `${legacyWeekKey}-P1`;
    console.log(`[weekly-distribute] Legacy weekKey format detected, using periodKey=${periodKey}`);
  }

  const weekIndexStr = searchParams.get("weekIndex");
  const force = searchParams.get("force") === "1" || searchParams.get("force") === "true";

  if (!periodKey || !weekIndexStr) {
    return NextResponse.json(
      { ok: false, error: "MISSING_PARAMS", required: ["periodKey (or weekKey)", "weekIndex"] },
      { status: 400 }
    );
  }

  // Parse the period key to extract weekKey and period number
  let weekKey: string;
  let period: 1 | 2;
  try {
    const parsed = parsePeriodKey(periodKey);
    weekKey = parsed.weekKey;
    period = parsed.period;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PERIOD_KEY", message: (err as Error).message },
      { status: 400 }
    );
  }

  // Stats are looked up by the underlying weekKey (not periodKey)
  const statsWeekKey = searchParams.get("statsWeekKey") || weekKey;

  const weekIndex = parseInt(weekIndexStr, 10);
  if (isNaN(weekIndex) || weekIndex < 0) {
    return NextResponse.json({ ok: false, error: "INVALID_WEEK_INDEX" }, { status: 400 });
  }

  const now = new Date();
  const runId = `${periodKey}-${now.getTime()}`;

  // Idempotency / batch handling - use periodKey for batch uniqueness
  // Note: RewardBatch.weekKey field stores periodKey for twice-weekly payouts
  const existingBatch = await db.rewardBatch.findUnique({ where: { weekKey: periodKey } });

  if (existingBatch) {
    if (existingBatch.status === BatchStatus.DONE) {
      if (!force) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "already_processed",
          periodKey,
          weekKey,
          period,
          batchId: existingBatch.id,
          totalUsers: existingBatch.totalUsers,
          totalAmount: existingBatch.totalAmount?.toString(),
        });
      }

      const onChainEpoch = await db.claimEpoch.findFirst({
        where: { weekKey: periodKey, setOnChain: true },
        select: { epoch: true, version: true },
      });
      if (onChainEpoch) {
        return NextResponse.json(
          {
            ok: false,
            error: "EPOCH_ONCHAIN",
            message: `Epoch ${onChainEpoch.epoch} (v${onChainEpoch.version}) is already on-chain. Refusing to rerun.`,
            periodKey,
          },
          { status: 409 }
        );
      }

      await db.$transaction(async (tx) => {
        await tx.claimLeaf.deleteMany({ where: { weekKey: periodKey } });
        await tx.claimEpoch.deleteMany({ where: { weekKey: periodKey } });
        await tx.rewardEvent.deleteMany({ where: { weekKey: periodKey } });
        await tx.rewardBatch.delete({ where: { weekKey: periodKey } });

        // Note: We don't reset paidAtomic since stats are per-week, not per-period
        // paidAtomic would need to be tracked per-period if needed
      });
    } else if (existingBatch.status === BatchStatus.RUNNING) {
      const batchAge = now.getTime() - existingBatch.startedAt.getTime();
      if (batchAge > STALE_BATCH_MS && force) {
        console.log(
          `[weekly-distribute] Stale batch detected (${Math.round(batchAge / 1000)}s old), force resetting...`
        );
        await db.$transaction(async (tx) => {
          await tx.claimLeaf.deleteMany({ where: { weekKey: periodKey } });
          await tx.claimEpoch.deleteMany({ where: { weekKey: periodKey } });
          await tx.rewardEvent.deleteMany({ where: { weekKey: periodKey } });
          await tx.rewardBatch.delete({ where: { weekKey: periodKey } });
        });
      } else {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "already_running",
          periodKey,
          batchId: existingBatch.id,
          startedAt: existingBatch.startedAt.toISOString(),
          runId: existingBatch.runId,
        });
      }
    } else if (existingBatch.status === BatchStatus.FAILED) {
      console.log(`[weekly-distribute] Previous batch failed, clearing and retrying...`);
      await db.$transaction(async (tx) => {
        await tx.claimLeaf.deleteMany({ where: { weekKey: periodKey } });
        await tx.claimEpoch.deleteMany({ where: { weekKey: periodKey } });
        await tx.rewardEvent.deleteMany({ where: { weekKey: periodKey } });
        await tx.rewardBatch.delete({ where: { weekKey: periodKey } });
      });
    }
  }

  // Claim batch - store periodKey in weekKey field
  let batch;
  try {
    batch = await db.rewardBatch.create({
      data: { weekKey: periodKey, status: BatchStatus.RUNNING, runId, startedAt: now },
    });
  } catch (e: unknown) {
    const prismaError = e as { code?: string };
    if (prismaError?.code === "P2002") {
      const existing = await db.rewardBatch.findUnique({ where: { weekKey: periodKey } });
      if (existing?.status === BatchStatus.DONE) {
        return NextResponse.json({ ok: true, skipped: true, reason: "already_processed", periodKey, batchId: existing.id });
      }
      return NextResponse.json({ ok: true, skipped: true, reason: "already_running", periodKey, batchId: existing?.id });
    }
    throw e;
  }

  try {
    const cfg = await getAdminConfig();

    // Leaderboard thresholds (existing)
    const minWeeklyScoreThreshold = cfg.minWeeklyScoreThreshold;
    const minMvmThreshold = cfg.minMvmThreshold;

    // Likes sub-slices (existing)
    const allTimeLikesBps = BigInt(cfg.allTimeLikesBpsOfLikes);
    const memberVoterBps = BigInt(cfg.memberVoterBpsOfLikes);
    const weeklyDiamondBps = 10000n - allTimeLikesBps - memberVoterBps;

    // Total emission for this period (half of weekly emission for twice-weekly payouts)
    // Override still applies but is interpreted as the full weekly amount (divided by 2)
    const weeklyEmission: bigint =
      (cfg.weeklyEmissionOverride as bigint | null) ?? getWeeklyEmission(weekIndex);
    const totalEmission = weeklyEmission / 2n; // Half per period

    // Top-level budgets (69/31 from cfg)
    const xessexBudget = (totalEmission * BigInt(cfg.xessexPoolBps)) / 10000n;
    const embedBudget = (totalEmission * BigInt(cfg.embedPoolBps)) / 10000n;

    const pools: { pool: Pool; budget: bigint }[] = [
      { pool: "XESSEX", budget: xessexBudget },
      { pool: "EMBED", budget: embedBudget },
    ];

    console.log(`[weekly-distribute] Period ${periodKey} (P${period} of week ${weekKey}, index ${weekIndex})`);
    console.log(`[weekly-distribute] Period emission: ${formatXess(totalEmission)} XESS (half of ${formatXess(weeklyEmission)} weekly)`);
    console.log(`[weekly-distribute] Budgets -> XESSEX: ${formatXess(xessexBudget)} | EMBED: ${formatXess(embedBudget)}`);
    if (statsWeekKey && statsWeekKey !== weekKey) console.log(`[weekly-distribute] Stats Source Week ${statsWeekKey}`);

    const allRewards: UserReward[] = [];
    const poolSummary: Record<string, Record<string, string | number>> = {};
    const burnsByPool = new Map<Pool, bigint>(); // Track burned amounts per pool

    // Build rewards pool-by-pool
    for (const pr of pools) {
      const pool = pr.pool;
      const pfx = poolPrefix(pool);
      const poolBudget = pr.budget;

      // ----------------------------
      // 1) FLAT FIRST
      // ----------------------------
      const weeklyActiveBonusAtomic: bigint = cfg.weeklyActiveBonusAtomic;

      const { byUser: flatByUserRaw, flatLedgerRows, activeUserIds } = await computeFlatForPool(
        statsWeekKey!,
        pool,
        weeklyActiveBonusAtomic
      );

      // Remove reward-banned / global-banned users from flat rewards
      if (flatByUserRaw.size > 0) {
        const heldUsers = await db.user.findMany({
          where: {
            id: { in: Array.from(flatByUserRaw.keys()) },
            OR: [
              { rewardBanStatus: { in: ["TEMP_BANNED", "PERM_BANNED"] } },
              { globalBanStatus: { in: ["TEMP_BANNED", "PERM_BANNED"] } },
            ],
          },
          select: { id: true, rewardBanStatus: true, rewardBanUntil: true },
        });
        for (const u of heldUsers) {
          // Allow expired temp bans through
          if (u.rewardBanStatus === "TEMP_BANNED" && u.rewardBanUntil && u.rewardBanUntil < new Date()) continue;
          flatByUserRaw.delete(u.id);
        }
      }

      const flatCapAtomic: bigint =
        pool === "XESSEX" ? cfg.flatCapXessexAtomic : cfg.flatCapEmbedAtomic;

      const { cappedByUser } = applyFlatCaps(pool, flatByUserRaw, flatCapAtomic);

      // Scale down flat if it exceeds pool budget (if enabled)
      const allowFlatScaling = !!cfg.allowFlatScaling;
      const { scaledByUser: flatScaledByUser, totalPaid: flatPaid, scalePpm } = scaleDownIfOverBudget(
        cappedByUser,
        poolBudget
      );

      if (!allowFlatScaling) {
        const flatTotal = Array.from(cappedByUser.values()).reduce((a, b) => a + b, 0n);
        if (flatTotal > poolBudget) {
          throw new Error(`[${pool}] Flat payouts exceed pool budget and allowFlatScaling=false`);
        }
      }

      // Create a single flat-total RewardEvent per user (idempotent)
      // (details remain in FlatActionLedger; this is just the paid result)
      for (const [userId, amount] of flatScaledByUser.entries()) {
        if (amount <= 0n) continue;
        allRewards.push({
          userId,
          walletAddress: null, // resolved later
          amount,
          type: "WEEKLY_COMMENTS",
          refType: `${pfx}:flat_total`,
        });
      }

      let remaining = poolBudget - flatPaid;
      if (remaining < 0n) remaining = 0n;

      // ----------------------------
      // 2) LEADERBOARD SECOND (NO CAPS)
      // ----------------------------
      if (cfg.rewardMode === "FLAT_ONLY") {
        poolSummary[pfx] = {
          budget: formatXess(poolBudget),
          flatPaid: formatXess(flatPaid),
          leaderboardPaid: "0",
          burned: formatXess(poolBudget - flatPaid),
          flatLedgerRows,
          weeklyActiveUsers: activeUserIds.length,
          flatScalePpm: scalePpm.toString(),
          mode: "FLAT_ONLY",
        };
        continue;
      }

      // If LEADERBOARD_ONLY, ignore flat entirely for this pool
      if (cfg.rewardMode === "LEADERBOARD_ONLY") {
        remaining = poolBudget;
      }

      // Leaderboard pools from remaining
      const likesPool = (remaining * LIKES_POOL_BPS) / 10000n;
      const mvmPool = (remaining * MVM_POOL_BPS) / 10000n;
      const commentsPool = (remaining * COMMENTS_POOL_BPS) / 10000n;
      const referralsPool = (remaining * REFERRALS_POOL_BPS) / 10000n;

      const weeklyDiamondPool = (likesPool * weeklyDiamondBps) / 10000n;
      const allTimeLikesPool = (likesPool * allTimeLikesBps) / 10000n;
      const memberVoterPool = (likesPool * memberVoterBps) / 10000n;

      // --- Weekly score (top 50) ---
      const top50 = await getTop50WeeklyScore(statsWeekKey!, pool, minWeeklyScoreThreshold);
      const sumScore = top50.reduce((acc, w) => acc + w.score, 0);

      if (top50.length > 0 && weeklyDiamondPool > 0n) {
        const basePool = (weeklyDiamondPool * 80n) / 100n;
        const ladderPool = (weeklyDiamondPool * 20n) / 100n;

        for (let i = 0; i < top50.length; i++) {
          const w = top50[i];

          const base = sumScore > 0 ? (basePool * BigInt(w.score)) / BigInt(sumScore) : 0n;
          const ladderPercent = LADDER_PERCENTS[i] || 0;
          const ladder = (ladderPool * BigInt(Math.round(ladderPercent * 1000))) / 100000n;

          const total = base + ladder;
          if (total > 0n) {
            allRewards.push({
              userId: w.userId,
              walletAddress: null,
              amount: total,
              type: "WEEKLY_LIKES",
              refType: `${pfx}:weekly_score`,
            });
          }
        }
      }

      // --- All-time likes (top 50) ---
      const allTimeStats = await db.allTimeUserStat.findMany({
        where: { pool, scoreReceived: { gt: 0 }, user: eligibleUserWhere() },
        orderBy: { scoreReceived: "desc" },
        take: 50,
        include: { user: { select: { id: true, walletAddress: true } } },
      });

      if (allTimeStats.length > 0 && allTimeLikesPool > 0n) {
        const totalAllTimeScore = allTimeStats.reduce((sum, s) => sum + s.scoreReceived, 0);
        const basePool = (allTimeLikesPool * 80n) / 100n;
        const ladderPool = (allTimeLikesPool * 20n) / 100n;

        for (let i = 0; i < allTimeStats.length; i++) {
          const stat = allTimeStats[i];
          const baseReward =
            totalAllTimeScore > 0 ? (basePool * BigInt(stat.scoreReceived)) / BigInt(totalAllTimeScore) : 0n;
          const ladderPercent = LADDER_PERCENTS[i] || 0;
          const ladderReward = (ladderPool * BigInt(Math.round(ladderPercent * 1000))) / 100000n;

          const totalReward = baseReward + ladderReward;
          if (totalReward > 0n) {
            allRewards.push({
              userId: stat.userId,
              walletAddress: stat.user.walletAddress,
              amount: totalReward,
              type: "ALLTIME_LIKES",
              refType: `${pfx}:alltime_score`,
            });
          }
        }
      }

      // --- Voter rewards ---
      const voterStats = await db.weeklyVoterStat.findMany({
        where: { weekKey: statsWeekKey!, pool, votesCast: { gt: 0 }, user: eligibleUserWhere() },
        include: { user: { select: { id: true, walletAddress: true } } },
      });

      if (voterStats.length > 0 && memberVoterPool > 0n) {
        const totalVotes = voterStats.reduce((sum, s) => sum + s.votesCast, 0);
        for (const stat of voterStats) {
          const reward = totalVotes > 0 ? (memberVoterPool * BigInt(stat.votesCast)) / BigInt(totalVotes) : 0n;
          if (reward > 0n) {
            allRewards.push({
              userId: stat.userId,
              walletAddress: stat.user.walletAddress,
              amount: reward,
              type: "WEEKLY_VOTER",
              refType: `${pfx}:voter`,
            });
          }
        }
      }

      // --- MVM rewards (monthly, but paid weekly) ---
      const monthKey = monthKeyUTC(new Date(statsWeekKey!));
      const mvmStats = await db.monthlyUserStat.findMany({
        where: { monthKey, pool, mvmPoints: { gte: minMvmThreshold }, user: eligibleUserWhere() },
        orderBy: { mvmPoints: "desc" },
        take: 50,
        include: { user: { select: { id: true, walletAddress: true } } },
      });

      const totalMonthMvm = mvmStats.reduce((sum, s) => sum + s.mvmPoints, 0);
      if (totalMonthMvm > 0 && mvmStats.length > 0 && mvmPool > 0n) {
        const basePool = (mvmPool * 80n) / 100n;
        const ladderPool = (mvmPool * 20n) / 100n;

        for (let i = 0; i < mvmStats.length; i++) {
          const stat = mvmStats[i];
          const baseReward = (basePool * BigInt(stat.mvmPoints)) / BigInt(totalMonthMvm);
          const ladderPercent = LADDER_PERCENTS[i] || 0;
          const ladderReward = (ladderPool * BigInt(Math.round(ladderPercent * 1000))) / 100000n;
          const totalReward = baseReward + ladderReward;

          if (totalReward > 0n) {
            allRewards.push({
              userId: stat.userId,
              walletAddress: stat.user.walletAddress,
              amount: totalReward,
              type: "WEEKLY_MVM",
              refType: `${pfx}:mvm`,
            });
          }
        }
      }

      // --- Comments rewards ---
      const commentStats = await db.weeklyUserStat.findMany({
        where: { weekKey: statsWeekKey!, pool, diamondComments: { gt: 0 }, user: eligibleUserWhere() },
        include: { user: { select: { id: true, walletAddress: true } } },
      });

      if (commentStats.length > 0 && commentsPool > 0n) {
        const totalComments = commentStats.reduce((sum, s) => sum + s.diamondComments, 0);
        for (const stat of commentStats) {
          const reward = totalComments > 0 ? (commentsPool * BigInt(stat.diamondComments)) / BigInt(totalComments) : 0n;
          if (reward > 0n) {
            allRewards.push({
              userId: stat.userId,
              walletAddress: stat.user.walletAddress,
              amount: reward,
              type: "WEEKLY_COMMENTS",
              refType: `${pfx}:comments`,
            });
          }
        }
      }

      // --- Referrals (per-pool budget) ---
      // Calculate earnedByUser for THIS pool using THIS pool's rewards excluding referral rewards
      const earnedByUser = new Map<string, bigint>();
      for (const r of allRewards) {
        // only include rewards for this pool (refType prefix) and exclude referral types
        if (!r.refType.startsWith(`${pfx}:`)) continue;
        if (r.type.startsWith("REF_")) continue;
        earnedByUser.set(r.userId, (earnedByUser.get(r.userId) || 0n) + r.amount);
      }

      type RefReward = {
        userId: string;
        walletAddress: string;
        amount: bigint;
        type: "REF_L1" | "REF_L2" | "REF_L3";
        earnerId: string;
      };

      const referralOwed: RefReward[] = [];
      let totalReferralOwed = 0n;

      for (const [earnerId, earned] of earnedByUser.entries()) {
        if (earned <= 0n) continue;
        const chain = await getReferralChain(earnerId);
        if (chain.length === 0) continue;

        if (chain[0]) {
          const a1 = (earned * REF_L1_BPS) / 10000n;
          if (a1 > 0n) {
            referralOwed.push({ userId: chain[0].id, walletAddress: chain[0].wallet, amount: a1, type: "REF_L1", earnerId });
            totalReferralOwed += a1;
          }
        }
        if (chain[1]) {
          const a2 = (earned * REF_L2_BPS) / 10000n;
          if (a2 > 0n) {
            referralOwed.push({ userId: chain[1].id, walletAddress: chain[1].wallet, amount: a2, type: "REF_L2", earnerId });
            totalReferralOwed += a2;
          }
        }
        if (chain[2]) {
          const a3 = (earned * REF_L3_BPS) / 10000n;
          if (a3 > 0n) {
            referralOwed.push({ userId: chain[2].id, walletAddress: chain[2].wallet, amount: a3, type: "REF_L3", earnerId });
            totalReferralOwed += a3;
          }
        }
      }

      const scale = totalReferralOwed > referralsPool ? (referralsPool * 1_000_000n) / totalReferralOwed : 1_000_000n;

      let referralPaid = 0n;
      for (const r of referralOwed) {
        const scaled = (r.amount * scale) / 1_000_000n;
        if (scaled <= 0n) continue;

        allRewards.push({
          userId: r.userId,
          walletAddress: r.walletAddress,
          amount: scaled,
          type: r.type,
          referralFromUserId: r.earnerId,
          refType: `${pfx}:${r.type.toLowerCase()}`,
        });
        referralPaid += scaled;
      }

      // Pool summary
      const leaderboardPaid = (() => {
        // sum rewards for this pool excluding flat_total
        let s = 0n;
        for (const r of allRewards) {
          if (!r.refType.startsWith(`${pfx}:`)) continue;
          if (r.refType === `${pfx}:flat_total` && cfg.rewardMode !== "LEADERBOARD_ONLY") continue;
          if (cfg.rewardMode === "LEADERBOARD_ONLY" && r.refType === `${pfx}:flat_total`) continue;
          // everything else is leaderboard-layer
          if (r.refType !== `${pfx}:flat_total`) s += r.amount;
        }
        return s;
      })();

      const burned = poolBudget - (cfg.rewardMode === "LEADERBOARD_ONLY" ? 0n : flatPaid) - leaderboardPaid;

      // Track burned amount for this pool (only if positive)
      if (burned > 0n) {
        burnsByPool.set(pool, burned);
      }

      poolSummary[pfx] = {
        mode: cfg.rewardMode,
        budget: formatXess(poolBudget),
        flatPaid: cfg.rewardMode === "LEADERBOARD_ONLY" ? "0" : formatXess(flatPaid),
        flatCap: formatXess(flatCapAtomic),
        flatScalePpm: cfg.rewardMode === "LEADERBOARD_ONLY" ? "n/a" : scalePpm.toString(),
        flatLedgerRows,
        weeklyActiveUsers: activeUserIds.length,
        remainingForLeaderboards: formatXess(remaining),
        leaderboardPaid: formatXess(leaderboardPaid),
        referralPaid: formatXess(referralPaid),
        burned: formatXess(burned < 0n ? 0n : burned),
      };
    }

    // Resolve wallet addresses for any rewards missing walletAddress
    const uniqueUserIds = Array.from(new Set(allRewards.map((r) => r.userId)));
    const users = await db.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: { id: true, walletAddress: true },
    });
    const walletMap = new Map(users.map((u) => [u.id, u.walletAddress]));

    for (const r of allRewards) {
      if (!r.walletAddress) r.walletAddress = walletMap.get(r.userId) || null;
    }

    // Aggregate rewards by user for totals
    const userRewards = new Map<string, { amount: bigint; wallet: string | null; refTypes: Set<string> }>();
    for (const r of allRewards) {
      const existing = userRewards.get(r.userId);
      if (existing) {
        existing.amount += r.amount;
        existing.refTypes.add(r.refType);
        if (r.walletAddress && !existing.wallet) existing.wallet = r.walletAddress;
      } else {
        userRewards.set(r.userId, { amount: r.amount, wallet: r.walletAddress, refTypes: new Set([r.refType]) });
      }
    }

    const totalAmount = Array.from(userRewards.values()).reduce((sum, r) => sum + r.amount, 0n);

    // RewardEvent createMany rows - use periodKey in weekKey field for twice-weekly tracking
    const rewardEventData = allRewards.map((reward) => {
      // Unique refId includes periodKey and pool via refType prefix
      const isReferral = reward.type.startsWith("REF_");
      const refId =
        isReferral && reward.referralFromUserId
          ? `${periodKey}:${reward.userId}:${reward.referralFromUserId}:${reward.refType}`
          : `${periodKey}:${reward.userId}:${reward.refType}`;

      return {
        userId: reward.userId,
        referralFromUserId: reward.referralFromUserId ?? null,
        type: reward.type,
        amount: reward.amount,
        status: "PAID" as const,
        weekKey: periodKey, // Store periodKey in weekKey field for twice-weekly payouts
        refType: reward.refType,
        refId,
      };
    });

    // Persist RewardEvents + paidAtomic + batch DONE
    await db.$transaction(async (tx) => {
      await tx.rewardEvent.createMany({ data: rewardEventData, skipDuplicates: true });

      // paidAtomic is 9 decimals on-chain (same as your current code)
      const DECIMAL_CONVERSION = 1000n;

      // We update paidAtomic on WeeklyUserStat per (weekKey,userId,pool) by summing rewards by pool.
      // If you want paidAtomic to represent total across both pools on a single row, don't split stats by pool.
      const paidByUserPool = new Map<string, bigint>(); // key: `${userId}:${pool}`
      for (const r of allRewards) {
        // Determine pool by refType prefix
        const pool: Pool =
          r.refType.startsWith("xessex:") ? "XESSEX" :
          r.refType.startsWith("embed:") ? "EMBED" :
          "EMBED";
        const key = `${r.userId}:${pool}`;
        paidByUserPool.set(key, (paidByUserPool.get(key) || 0n) + r.amount);
      }

      for (const [key, amt6] of paidByUserPool.entries()) {
        const [userId, pool] = key.split(":") as [string, Pool];
        const paidAtomic9 = amt6 * DECIMAL_CONVERSION;

        await tx.weeklyUserStat.upsert({
          where: { weekKey_userId_pool: { weekKey: statsWeekKey!, userId, pool } },
          create: {
            weekKey: statsWeekKey!,
            userId,
            pool,
            paidAtomic: paidAtomic9,
          },
          update: {
            paidAtomic: paidAtomic9,
          },
        });
      }

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

      // Record burn amounts for unused emissions
      for (const [pool, burnAmount] of burnsByPool.entries()) {
        if (burnAmount > 0n) {
          await tx.burnRecord.create({
            data: {
              weekKey: periodKey, // Store periodKey for twice-weekly tracking
              pool,
              reason: "unused_emission",
              amount: burnAmount,
              description: `Unused ${pool} pool emission for period ${periodKey}`,
            },
          });
          console.log(`[weekly-distribute] Burned ${formatXess(burnAmount)} XESS from ${pool} pool`);
        }
      }
    });

    // Calculate total burned
    const totalBurned = Array.from(burnsByPool.values()).reduce((a, b) => a + b, 0n);

    return NextResponse.json({
      ok: true,
      periodKey,
      period,
      weekKey,
      statsWeekKey,
      weekIndex,
      periodEmission: formatXess(totalEmission),
      weeklyEmission: formatXess(weeklyEmission),
      budgets: {
        xessex: poolSummary["xessex"]?.budget,
        embed: poolSummary["embed"]?.budget,
      },
      pools: poolSummary,
      totalUsers: userRewards.size,
      totalRewards: allRewards.length,
      totalAmount: formatXess(totalAmount),
      totalBurned: formatXess(totalBurned),
      burnsByPool: {
        xessex: formatXess(burnsByPool.get("XESSEX") ?? 0n),
        embed: formatXess(burnsByPool.get("EMBED") ?? 0n),
      },
      batchId: batch.id,
      nextStep: "Run build-week cron to create merkle tree for on-chain claims",
    });
  } catch (error) {
    console.error("[WEEKLY_DISTRIBUTE] Error:", error);

    if (batch) {
      await db.rewardBatch
        .update({ where: { id: batch.id }, data: { status: BatchStatus.FAILED } })
        .catch(() => {});
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
