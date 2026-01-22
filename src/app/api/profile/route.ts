import { NextResponse } from "next/server";
import { getCurrentUser, isSubscriptionActive } from "@/lib/auth";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: true, authed: false }, { headers: noCache });
  }

  const sub = user.subscription ?? null;
  const active = !!sub && isSubscriptionActive(sub);

  const membership =
    active && sub?.tier === "DIAMOND"
      ? "DIAMOND"
      : active
        ? "MEMBER"
        : "FREE";

  // Get video watch count (count of star ratings as proxy for videos watched)
  const videosWatched = await db.videoStarRating.count({
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
  const specialCreditAccount = await db.specialCreditAccount.findUnique({
    where: { userId: user.id },
    select: { balanceMicro: true },
  });
  const specialCreditsMicro = specialCreditAccount?.balanceMicro ?? 0n;

  // Check for pending manual payments (Cash App)
  const pendingManualPayment = await db.manualPayment.findFirst({
    where: { userId: user.id, status: "PENDING" },
    select: { id: true, planCode: true, requestedTier: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    authed: true,
    email: user.email ?? null,
    walletAddress: user.walletAddress ?? null,
    solWallet: user.solWallet ?? null,
    membership,
    sub: sub
      ? {
          tier: sub.tier,
          status: sub.status,
          expiresAt: sub.expiresAt?.toISOString() ?? null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
        }
      : null,
    stats: {
      videosWatched,
      accountCreated: user.createdAt.toISOString(),
    },
    referral: {
      code: user.referralCode ?? null,
      referralCount,
      referredById: user.referredById ?? null,
      referredByEmail,
    },
    specialCreditsMicro: specialCreditsMicro.toString(),
    pendingManualPayment: pendingManualPayment
      ? {
          id: pendingManualPayment.id,
          planCode: pendingManualPayment.planCode,
          requestedTier: pendingManualPayment.requestedTier,
          createdAt: pendingManualPayment.createdAt.toISOString(),
        }
      : null,
  }, { headers: noCache });
}
