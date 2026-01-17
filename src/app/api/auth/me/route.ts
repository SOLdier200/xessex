/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { getCurrentUser, isSubscriptionActive } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: true, authed: false, user: null });
  }

  const sub = user.subscription ?? null;
  const active = !!sub && isSubscriptionActive(sub);

  const membership =
    active && sub?.tier === "DIAMOND"
      ? "DIAMOND"
      : active
        ? "MEMBER"
        : "FREE";

  // Check if Diamond email user needs to link wallet
  const hasLinkedWallet = !!user.walletAddress || !!user.solWallet;
  const needsSolWalletLink = membership === "DIAMOND" && !!user.email && !hasLinkedWallet;

  // Return standardized user object (new shape) + backward compat fields
  return NextResponse.json({
    ok: true,
    authed: true,

    // New standardized shape
    user: {
      id: user.id,
      email: user.email ?? null,
      role: membership,
      solWallet: user.solWallet ?? null,
      walletAddress: user.walletAddress ?? null,
    },

    // Legacy fields for backward compatibility
    membership,
    walletAddress: user.walletAddress ?? user.solWallet ?? null,
    hasEmail: !!user.email,
    email: user.email ?? null,
    needsSolWalletLink,
    sub: sub
      ? { tier: sub.tier, status: sub.status, expiresAt: sub.expiresAt }
      : null,
  });
}
