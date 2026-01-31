import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

/**
 * GET /api/debug/referral-missing?weekKey=2026-01-20
 * 
 * Find users who might be missing referral payments:
 * 1. Users with referrers who earned rewards but referrer didn't get referral reward
 * 2. Referrers missing wallets (can't receive payouts)
 * 3. Users with broken referral chains (referrer doesn't exist)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const weekKey = searchParams.get("weekKey");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  if (!weekKey) {
    // Get the most recent weekKey
    const latestBatch = await db.rewardBatch.findFirst({
      orderBy: { weekKey: "desc" },
      select: { weekKey: true },
    });
    
    if (!latestBatch) {
      return NextResponse.json({ 
        ok: false, 
        error: "NO_BATCHES",
        message: "No reward batches found. Provide weekKey param." 
      }, { status: 400 });
    }

    return NextResponse.json({
      ok: false,
      error: "MISSING_WEEK_KEY",
      message: "Please provide weekKey param",
      hint: `Latest available: ?weekKey=${latestBatch.weekKey}`,
    }, { status: 400 });
  }

  // 1. Get all earners for this week (users with non-referral rewards)
  const earnersThisWeek = await db.rewardEvent.findMany({
    where: {
      weekKey,
      type: { notIn: ["REF_L1", "REF_L2", "REF_L3"] },
    },
    select: {
      userId: true,
      amount: true,
      type: true,
    },
  });

  // Aggregate earnings by user
  const earningsByUser = new Map<string, bigint>();
  for (const e of earnersThisWeek) {
    earningsByUser.set(e.userId, (earningsByUser.get(e.userId) || 0n) + e.amount);
  }

  // 2. Get all earners who have referrers
  const earnersWithReferrers = await db.user.findMany({
    where: {
      id: { in: Array.from(earningsByUser.keys()) },
      referredById: { not: null },
    },
    select: {
      id: true,
      memberId: true,
      referredById: true,
      referredBy: {
        select: {
          id: true,
          memberId: true,
          solWallet: true,
          walletAddress: true,
        },
      },
    },
  });

  // 3. Get all referral rewards for this week
  const referralRewards = await db.rewardEvent.findMany({
    where: {
      weekKey,
      type: { in: ["REF_L1", "REF_L2", "REF_L3"] },
    },
    select: {
      userId: true,
      referralFromUserId: true,
      type: true,
      amount: true,
    },
  });

  // Build a set of (referrerId, earnerId) pairs that got paid
  const paidReferralPairs = new Set<string>();
  for (const r of referralRewards) {
    if (r.referralFromUserId) {
      paidReferralPairs.add(`${r.userId}:${r.referralFromUserId}`);
    }
  }

  // 4. Find missing referral payments
  const missingPayments: {
    earnerId: string;
    earnerMemberId: string;
    earned: string;
    referrerId: string;
    referrerMemberId: string;
    reason: string;
  }[] = [];

  const referrersMissingWallets: {
    referrerId: string;
    referrerMemberId: string;
    affectedEarners: number;
    potentialLoss: string;
  }[] = [];

  const walletMissingMap = new Map<string, { count: number; amount: bigint; memberId: string }>();

  for (const earner of earnersWithReferrers) {
    const earned = earningsByUser.get(earner.id) || 0n;
    if (earned <= 0n) continue;

    const referrer = earner.referredBy;
    if (!referrer) {
      missingPayments.push({
        earnerId: earner.id,
        earnerMemberId: earner.memberId,
        earned: (Number(earned) / 1_000_000).toFixed(2),
        referrerId: earner.referredById!,
        referrerMemberId: "UNKNOWN",
        reason: "REFERRER_NOT_FOUND",
      });
      continue;
    }

    const referrerWallet = referrer.solWallet || referrer.walletAddress;
    if (!referrerWallet) {
      // Track referrers missing wallets
      const existing = walletMissingMap.get(referrer.id);
      if (existing) {
        existing.count++;
        existing.amount += earned;
      } else {
        walletMissingMap.set(referrer.id, { 
          count: 1, 
          amount: earned,
          memberId: referrer.memberId,
        });
      }
      continue;
    }

    // Check if L1 reward was paid
    const l1Paid = paidReferralPairs.has(`${referrer.id}:${earner.id}`);
    if (!l1Paid) {
      missingPayments.push({
        earnerId: earner.id,
        earnerMemberId: earner.memberId,
        earned: (Number(earned) / 1_000_000).toFixed(2),
        referrerId: referrer.id,
        referrerMemberId: referrer.memberId,
        reason: "L1_REWARD_NOT_CREATED",
      });
    }
  }

  // Convert wallet missing map to array
  for (const [referrerId, data] of walletMissingMap) {
    referrersMissingWallets.push({
      referrerId,
      referrerMemberId: data.memberId,
      affectedEarners: data.count,
      potentialLoss: (Number(data.amount * 1000n / 10000n) / 1_000_000).toFixed(2), // ~10% L1
    });
  }

  // Sort by potential loss
  referrersMissingWallets.sort((a, b) => parseFloat(b.potentialLoss) - parseFloat(a.potentialLoss));

  // 5. Summarize referral payouts for this week
  const referralSummary = {
    REF_L1: { count: 0, total: 0n },
    REF_L2: { count: 0, total: 0n },
    REF_L3: { count: 0, total: 0n },
  };

  for (const r of referralRewards) {
    const tier = r.type as keyof typeof referralSummary;
    referralSummary[tier].count++;
    referralSummary[tier].total += r.amount;
  }

  // 6. Get batch info
  const batch = await db.rewardBatch.findUnique({
    where: { weekKey },
    select: {
      status: true,
      totalUsers: true,
      totalAmount: true,
      finishedAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    weekKey,
    batch: batch ? {
      status: batch.status,
      totalUsers: batch.totalUsers,
      totalAmount: batch.totalAmount ? (Number(batch.totalAmount) / 1_000_000).toFixed(2) : null,
      finishedAt: batch.finishedAt?.toISOString(),
    } : null,
    summary: {
      totalEarners: earningsByUser.size,
      earnersWithReferrers: earnersWithReferrers.length,
      referralRewardsPaid: referralRewards.length,
    },
    referralPayoutsByTier: {
      L1: {
        count: referralSummary.REF_L1.count,
        total: (Number(referralSummary.REF_L1.total) / 1_000_000).toFixed(2) + " XESS",
      },
      L2: {
        count: referralSummary.REF_L2.count,
        total: (Number(referralSummary.REF_L2.total) / 1_000_000).toFixed(2) + " XESS",
      },
      L3: {
        count: referralSummary.REF_L3.count,
        total: (Number(referralSummary.REF_L3.total) / 1_000_000).toFixed(2) + " XESS",
      },
    },
    issues: {
      missingReferralPayments: missingPayments.slice(0, limit),
      missingPaymentsCount: missingPayments.length,
      referrersMissingWallets: referrersMissingWallets.slice(0, limit),
      referrersMissingWalletsCount: referrersMissingWallets.length,
    },
    health: missingPayments.length === 0 && referrersMissingWallets.length === 0
      ? "✅ All referral payments look correct"
      : `⚠️ Found ${missingPayments.length} missing payments, ${referrersMissingWallets.length} referrers without wallets`,
  });
}
