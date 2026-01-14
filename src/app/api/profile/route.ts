import { NextResponse } from "next/server";
import { getCurrentUser, isSubscriptionActive } from "@/lib/auth";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: true, authed: false });
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

  return NextResponse.json({
    ok: true,
    authed: true,
    email: user.email ?? null,
    walletAddress: user.walletAddress ?? user.solWallet ?? null,
    membership,
    sub: sub
      ? {
          tier: sub.tier,
          status: sub.status,
          expiresAt: sub.expiresAt?.toISOString() ?? null,
        }
      : null,
    stats: {
      videosWatched,
      accountCreated: user.createdAt.toISOString(),
    },
  });
}
