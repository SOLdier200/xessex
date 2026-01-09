import { NextResponse } from "next/server";
import { getCurrentUser, isSubscriptionActive } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: true, authed: false });

  const sub = user.subscription ?? null;
  const active = !!sub && isSubscriptionActive(sub);

  const membership =
    active && sub?.tier === "DIAMOND"
      ? "DIAMOND"
      : active
        ? "MEMBER"
        : "FREE";

  // Check if Diamond email user needs to link wallet
  // Email users link via solWallet, wallet-only users use walletAddress
  const hasLinkedWallet = !!user.walletAddress || !!user.solWallet;
  const needsSolWalletLink = membership === "DIAMOND" && !!user.email && !hasLinkedWallet;

  return NextResponse.json({
    ok: true,
    authed: true,
    membership,
    walletAddress: user.walletAddress ?? user.solWallet ?? null,
    needsSolWalletLink,
    sub: sub
      ? { tier: sub.tier, status: sub.status, expiresAt: sub.expiresAt }
      : null,
  });
}
