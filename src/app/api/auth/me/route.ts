/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

export async function GET() {
  const access = await getAccessContext();
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  const user = access.user;
  if (!user) {
    return NextResponse.json({ ok: true, authed: false, user: null }, { headers: noCache });
  }

  const sub = user.subscription ?? null;
  const membership =
    access.isAdminOrMod || access.tier === "diamond"
      ? "DIAMOND"
      : access.tier === "member"
        ? "MEMBER"
        : "FREE";

  let authProvider: "google" | "email" | "wallet" | "unknown" = "unknown";
  if (user.email) {
    if (user.passHash) {
      authProvider = "email";
    } else if (user.supabaseId) {
      authProvider = "google";
    } else {
      authProvider = "email";
    }
  } else if (user.walletAddress || user.solWallet) {
    authProvider = "wallet";
  }

  // Check if Diamond email user needs to link wallet
  // Auth wallet (walletAddress) = login + Diamond actions
  const needsAuthWalletLink = membership === "DIAMOND" && !!user.email && !user.walletAddress;

  // Payout wallet is optional; never required
  const needsPayoutWalletLink = false;

  // Legacy compat (old field name)
  const needsSolWalletLink = needsAuthWalletLink;

  // Return standardized user object (new shape) + backward compat fields
  return NextResponse.json({
    ok: true,
    authed: true,
    authProvider,

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
    needsAuthWalletLink,
    needsPayoutWalletLink,
    needsSolWalletLink, // back-compat: same as needsAuthWalletLink
    sub: sub
      ? { tier: sub.tier, status: sub.status, expiresAt: sub.expiresAt }
      : null,
  }, { headers: noCache });
}
