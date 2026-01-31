import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

/**
 * GET /api/debug/referral-chain?userId=xxx
 * Test the referral chain lookup for a user
 * 
 * Shows:
 * - User's direct referrer (L1)
 * - L1's referrer (L2)
 * - L2's referrer (L3)
 * - Whether each level has a linked wallet (required for payouts)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const walletAddress = searchParams.get("wallet");
  const memberId = searchParams.get("memberId");

  // Find user by any identifier
  let user;
  if (userId) {
    user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, memberId: true, walletAddress: true, referredById: true, referralCode: true },
    });
  } else if (walletAddress) {
    user = await db.user.findUnique({
      where: { walletAddress },
      select: { id: true, memberId: true, walletAddress: true, referredById: true, referralCode: true },
    });
  } else if (memberId) {
    user = await db.user.findUnique({
      where: { memberId },
      select: { id: true, memberId: true, walletAddress: true, referredById: true, referralCode: true },
    });
  } else {
    return NextResponse.json({ 
      ok: false, 
      error: "MISSING_PARAM",
      message: "Provide userId, wallet, or memberId"
    }, { status: 400 });
  }

  if (!user) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const chain: {
    level: string;
    userId: string;
    memberId: string;
    wallet: string | null;
    hasWallet: boolean;
    referralCode: string | null;
  }[] = [];

  // Build the chain
  let currentReferrerId = user.referredById;
  const levels = ["L1", "L2", "L3"];
  
  for (let i = 0; i < 3 && currentReferrerId; i++) {
    const referrer = await db.user.findUnique({
      where: { id: currentReferrerId },
      select: { 
        id: true, 
        memberId: true,
        
        walletAddress: true, 
        referredById: true,
        referralCode: true,
      },
    });

    if (!referrer) break;

    const wallet = referrer.walletAddress;
    chain.push({
      level: levels[i],
      userId: referrer.id,
      memberId: referrer.memberId,
      wallet: wallet ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : null,
      hasWallet: !!wallet,
      referralCode: referrer.referralCode,
    });

    currentReferrerId = referrer.referredById;
  }

  // Count user's referrals
  const referralCount = await db.user.count({
    where: { referredById: user.id },
  });

  // Get recent referral rewards this user has received
  const recentReferralRewards = await db.rewardEvent.findMany({
    where: {
      userId: user.id,
      type: { in: ["REF_L1", "REF_L2", "REF_L3"] },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      type: true,
      amount: true,
      weekKey: true,
      referralFromUserId: true,
    },
  });

  // Get recent rewards user has generated for their referrers
  const rewardsGeneratedForReferrers = await db.rewardEvent.findMany({
    where: {
      referralFromUserId: user.id,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      type: true,
      amount: true,
      weekKey: true,
      userId: true,
    },
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      memberId: user.memberId,
      wallet: (user.walletAddress) 
        ? `${(user.walletAddress)!.slice(0, 4)}...${(user.walletAddress)!.slice(-4)}`
        : null,
      hasWallet: !!(user.walletAddress),
      referralCode: user.referralCode,
      referralCount,
    },
    referralChain: chain,
    chainSummary: {
      depth: chain.length,
      allHaveWallets: chain.every(c => c.hasWallet),
      missingWallets: chain.filter(c => !c.hasWallet).map(c => c.level),
    },
    recentReferralRewardsReceived: recentReferralRewards.map(r => ({
      type: r.type,
      amount: (Number(r.amount) / 1_000_000).toFixed(2),
      weekKey: r.weekKey,
      fromUser: r.referralFromUserId?.slice(0, 8) + "...",
    })),
    rewardsGeneratedForReferrers: rewardsGeneratedForReferrers.map(r => ({
      type: r.type,
      amount: (Number(r.amount) / 1_000_000).toFixed(2),
      weekKey: r.weekKey,
      toUser: r.userId.slice(0, 8) + "...",
    })),
  });
}
