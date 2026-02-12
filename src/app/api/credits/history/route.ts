import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { getTierFromBalance, getTierInfo, TIER_TABLE } from "@/lib/specialCredits";
import { CREDIT_MICRO, XESS_MULTIPLIER } from "@/lib/rewardsConstants";
import { getXessAtomicBalance } from "@/lib/xessBalance";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get credit account
  const account = user.specialCreditAccount;
  const balanceMicro = account ? BigInt(account.balanceMicro) : 0n;
  const balanceDisplay = Number(balanceMicro) / Number(CREDIT_MICRO);

  // Fetch live on-chain XESS balance for accurate tier display
  let xessBalanceAtomic = 0n;
  if (user.walletAddress) {
    const liveBalance = await getXessAtomicBalance(user.walletAddress);

    // Fall back to latest snapshot if RPC failed (null) or returned 0
    if (liveBalance === null || liveBalance === 0n) {
      const latestSnapshot = await db.walletBalanceSnapshot.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });
      if (latestSnapshot && BigInt(latestSnapshot.balanceAtomic) > 0n) {
        xessBalanceAtomic = BigInt(latestSnapshot.balanceAtomic);
      }
    } else {
      xessBalanceAtomic = liveBalance;
    }
  }

  const tier = getTierFromBalance(xessBalanceAtomic);
  const tierInfo = getTierInfo(tier);

  // Get recent ledger entries (last 50)
  const ledger = await db.specialCreditLedger.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const entries = ledger.map((e) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    amountMicro: e.amountMicro.toString(),
    amountDisplay: Number(e.amountMicro) / Number(CREDIT_MICRO),
    reason: e.reason,
    refType: e.refType,
  }));

  // XESS balance for display (use floating point to preserve fractional tokens)
  const xessBalanceDisplay = Number(xessBalanceAtomic) / Number(XESS_MULTIPLIER);

  return NextResponse.json({
    balanceMicro: balanceMicro.toString(),
    balanceDisplay,
    xessBalance: xessBalanceDisplay,
    tier: tierInfo.tier,
    tierInfo: {
      minBalanceXess: tierInfo.minBalanceXess,
      monthlyCredits: tierInfo.monthlyCredits,
      nextTier: tierInfo.nextTier,
      nextTierMinXess: tierInfo.nextTierMinXess,
      nextTierMonthlyCredits: tierInfo.nextTier !== null
        ? Number(TIER_TABLE[tierInfo.nextTier].monthlyCredits)
        : null,
    },
    entries,
  });
}
