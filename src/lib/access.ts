/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { getCurrentUser, isSubscriptionActive, hasSubscriptionAccess, isTrialActive } from "@/lib/auth";

export type AccessTier = "free" | "member" | "diamond";

const TRIAL_DURATION_DAYS = 14;

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

  // Use hasSubscriptionAccess for content gating (includes PENDING/PARTIAL provisional access)
  const active = !!sub && hasSubscriptionAccess(sub);

  // Use isSubscriptionActive for checking if truly subscribed (ACTIVE/TRIAL only)
  const fullySubscribed = !!sub && isSubscriptionActive(sub);

  // Trial status
  const isOnTrial = sub?.status === "TRIAL" && active;
  const trialUsed = user?.trialUsed ?? false;
  const trialEndsAt = user?.trialEndsAt ?? null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  // PENDING/PARTIAL users can still start trials (fullySubscribed is false for them)
  const canStartTrial = !!user && !trialUsed && !fullySubscribed;

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

  // Diamond policy: Diamond accounts are wallet-based, not email-based
  // Email is optional (for recovery only). Wallet is required for Diamond features.
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

    // Trial status
    isOnTrial,
    trialUsed,
    trialEndsAt,
    trialDaysLeft,
    canStartTrial,
    trialDurationDays: TRIAL_DURATION_DAYS,

    // Permissions - Diamond tier gets full access (wallet link optional for features)
    canViewAllVideos: isAdminOrMod || tier === "member" || tier === "diamond",
    canComment: isAdminOrMod || tier === "diamond",
    canRateStars: isAdminOrMod || tier === "diamond",
    canVoteComments: isAdminOrMod || tier === "member" || tier === "diamond",
  };
}
