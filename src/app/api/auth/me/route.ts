/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  // ─────────────────────────────────────────────────────────────
  // WALLET FIELDS (clear, no fallback confusion)
  // ─────────────────────────────────────────────────────────────
  const authWallet = user.walletAddress ?? null;       // used for login + Diamond features
  const payoutWallet = user.solWallet ?? null;         // where rewards go (optional)
  const effectivePayoutWallet = payoutWallet ?? authWallet; // actual destination

  // ─────────────────────────────────────────────────────────────
  // FLAGS (only Diamond users need wallet linking)
  // ─────────────────────────────────────────────────────────────
  // Auth wallet needed only for Diamond tier (wallet is Diamond-only requirement)
  const needsAuthWalletLink = access.tier === "diamond" && !authWallet;

  // Payout wallet prompt only for Diamond without any payout destination
  const needsPayoutWalletLink = access.tier === "diamond" && !effectivePayoutWallet;

  // Legacy compat
  const needsSolWalletLink = needsAuthWalletLink;

  // Return clean response
  return NextResponse.json({
    ok: true,
    authed: true,
    authProvider,
    membership,

    // ─── New clear wallet fields ───
    authWallet,
    payoutWallet,
    effectivePayoutWallet,

    // ─── Clear flags ───
    needsAuthWalletLink,
    needsPayoutWalletLink,

    // ─── User object ───
    user: {
      id: user.id,
      email: user.email ?? null,
      role: membership,
      walletAddress: authWallet,
      solWallet: payoutWallet,
    },

    // ─── Legacy fields (for old UI code) ───
    hasEmail: !!user.email,
    email: user.email ?? null,
    walletAddress: authWallet, // NO fallback - auth wallet only
    needsSolWalletLink,
    sub: sub
      ? { tier: sub.tier, status: sub.status, expiresAt: sub.expiresAt }
      : null,
  }, { headers: noCache });
}
