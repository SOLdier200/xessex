/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { getCurrentUser, isSubscriptionActive } from "@/lib/auth";

export type AccessTier = "free" | "member" | "diamond";

// Env-based admin allowlist (comma-separated wallet addresses)
const ADMIN_WALLETS = new Set(
  (process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean)
);

export async function getAccessContext() {
  const user = await getCurrentUser();
  const sub = user?.subscription ?? null;

  const active = !!sub && isSubscriptionActive(sub);
  const tier: AccessTier =
    active && sub?.tier === "DIAMOND"
      ? "diamond"
      : active
        ? "member"
        : "free";

  // Check user role from database OR env allowlist
  const hasAdminRole = user?.role === "ADMIN" || user?.role === "MOD";
  const walletInAllowlist =
    !!(user?.walletAddress && ADMIN_WALLETS.has(user.walletAddress)) ||
    !!(user?.solWallet && ADMIN_WALLETS.has(user.solWallet));
  const isAdminOrMod = hasAdminRole || walletInAllowlist;

  // Wallet tracking - separate auth wallet (identity) from payout wallet (rewards)
  // walletAddress = auth wallet (used for sign-in / identity)
  // solWallet = payout wallet (where rewards go, can be same as auth or different)
  const hasAuthWallet = !!user?.walletAddress;
  const hasPayoutWallet = !!user?.solWallet;
  const hasAnyWallet = hasAuthWallet || hasPayoutWallet;

  // Diamond policy: must have an auth wallet to use Diamond-only features
  // This allows email users to buy Diamond, but they must link wallet to use features
  const diamondReady = tier === "diamond" && hasAuthWallet;

  // Prompt flags for UI
  const needsAuthWalletLink = tier === "diamond" && !hasAuthWallet;

  // Payout wallet is optional — never required
  const needsPayoutWalletLink = false;

  // Legacy compatibility - treat as needsAuthWalletLink (most important gating)
  const needsSolWalletLink = needsAuthWalletLink;

  return {
    user,
    sub,
    active,
    tier,
    isAuthed: !!user,
    isAdminOrMod,

    // Wallet status
    hasAuthWallet,
    hasPayoutWallet,
    hasAnyWallet,

    // Diamond activation
    diamondReady,
    needsAuthWalletLink,
    needsPayoutWalletLink,
    needsSolWalletLink, // legacy compat

    // Permissions - Diamond-only actions require diamondReady (wallet linked)
    canViewAllVideos: isAdminOrMod || tier === "member" || tier === "diamond",
    canComment: isAdminOrMod || diamondReady,
    canRateStars: isAdminOrMod || diamondReady,
    canVoteComments: isAdminOrMod || tier === "member" || tier === "diamond",
  };
}
