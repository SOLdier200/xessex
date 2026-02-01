import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";

export const runtime = "nodejs";

export async function GET() {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: true, authed: false }, { headers: noCache });
  }

  // Get video watch count (count of star ratings as proxy for videos watched)
  const videosWatched = await db.videoStarRating.count({
    where: { userId: user.id },
  });

  // Get video unlock count
  const videosUnlocked = await db.videoUnlock.count({
    where: { userId: user.id },
  });

  // Get referral data
  const referralCount = await db.user.count({
    where: { referredById: user.id },
  });

  // Get referrer info if user was referred
  let referredByEmail: string | null = null;
  if (user.referredById) {
    const referrer = await db.user.findUnique({
      where: { id: user.referredById },
      select: { email: true },
    });
    if (referrer?.email) {
      // Mask the email for privacy
      const [local, domain] = referrer.email.split("@");
      referredByEmail = `${local.slice(0, 2)}***@${domain}`;
    }
  }

  // Get special credits balance
  const specialCreditAccount = user.specialCreditAccount;
  const creditBalanceMicro = specialCreditAccount?.balanceMicro ?? 0n;
  const creditBalance = Number(creditBalanceMicro / CREDIT_MICRO);

  // Get latest wallet snapshot to determine XESS tier
  let xessTier = 0;
  let xessBalance = "0";
  const xessWallet = user.walletAddress;
  if (xessWallet) {
    const latestSnapshot = await db.walletBalanceSnapshot.findFirst({
      where: { wallet: xessWallet },
      orderBy: { createdAt: "desc" },
      select: { tier: true, balanceAtomic: true },
    });
    if (latestSnapshot) {
      xessTier = latestSnapshot.tier;
      xessBalance = latestSnapshot.balanceAtomic.toString();
    }
  }

  return NextResponse.json({
    ok: true,
    authed: true,
    email: user.email ?? null,
    walletAddress: user.walletAddress ?? null,
    memberId: user.memberId ?? null,
    recoveryEmail: user.recoveryEmail ?? null,
    recoveryEmailVerified: !!user.recoveryEmailVerifiedAt,
    stats: {
      videosWatched,
      videosUnlocked,
      accountCreated: user.createdAt.toISOString(),
    },
    referral: {
      code: user.referralCode ?? null,
      referralCount,
      referredById: user.referredById ?? null,
      referredByEmail,
    },
    creditBalance,
    creditBalanceMicro: creditBalanceMicro.toString(),
    xessTier,
    xessBalance,
  }, { headers: noCache });
}
