import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { CREDIT_MICRO, XESS_MULTIPLIER } from "@/lib/rewardsConstants";
import { signR2GetUrl } from "@/lib/r2";
import { getXessAtomicBalance } from "@/lib/xessBalance";
import { getTierFromBalance } from "@/lib/specialCredits";

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

  // Fetch live on-chain XESS balance for accurate tier display
  let xessTier = 0;
  let xessBalance = "0";
  const xessWallet = user.walletAddress;
  if (xessWallet) {
    let balanceAtomic = await getXessAtomicBalance(xessWallet);

    // getXessAtomicBalance silently returns 0n on RPC errors,
    // so fall back to latest snapshot if live returned 0 but snapshot has data
    if (balanceAtomic === 0n) {
      const latestSnapshot = await db.walletBalanceSnapshot.findFirst({
        where: { wallet: xessWallet },
        orderBy: { dateKey: "desc" },
        select: { tier: true, balanceAtomic: true },
      });
      if (latestSnapshot && BigInt(latestSnapshot.balanceAtomic) > 0n) {
        balanceAtomic = BigInt(latestSnapshot.balanceAtomic);
      }
    }

    xessTier = getTierFromBalance(balanceAtomic);
    xessBalance = balanceAtomic.toString();
  }

  // Get avatar URL if user has a profile picture
  let avatarUrl: string | null = null;
  if (user.profilePictureKey) {
    try {
      avatarUrl = await signR2GetUrl(user.profilePictureKey, 3600);
    } catch {
      // Silent fail - avatar just won't display
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
    avatarUrl,
    username: user.username ?? null,
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
