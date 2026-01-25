/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 *
 * walletFlows.ts - Centralized wallet API calls
 *
 * This is the ONLY file that should contain wallet auth endpoint URLs.
 * All UI components should import from here, never use raw fetch("/api/auth/...").
 *
 * Four flows:
 * 1) Wallet Login - existing Diamond users logging in with walletAddress
 * 2) Diamond Signup - new wallet-native Diamond users
 * 3) Payout Link - Members linking solWallet for rewards
 * 4) Diamond Upgrade - Members converting to Diamond (sets walletAddress)
 */

// ============================================================================
// Types
// ============================================================================

export type ChallengeResponse =
  | { ok: true; message: string; nonce?: string; expiresAt: string }
  | { ok: false; error: string };

export type VerifyResponse =
  | { ok: true; switched?: boolean; switchedToDiamond?: boolean; alreadyActive?: boolean }
  | { ok: false; error: string; wallet?: string };

export type SimpleResponse = { ok: true } | { ok: false; error: string };

// ============================================================================
// Helper
// ============================================================================

async function postJSON<T>(url: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  return res.json();
}

// ============================================================================
// Platform detection
// ============================================================================

export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

// ============================================================================
// 1) WALLET LOGIN - For existing Diamond users with walletAddress
// ============================================================================

/**
 * Get a challenge for wallet login (cookie-based challenge)
 * Only for users who already have walletAddress set (Diamond auth)
 */
export async function walletLoginChallenge(wallet: string): Promise<ChallengeResponse> {
  return postJSON<ChallengeResponse>("/api/auth/challenge", { wallet, purpose: "LOGIN" });
}

/**
 * Verify wallet signature for login
 * Will only succeed if wallet matches a user's walletAddress (not solWallet)
 */
export async function walletLoginVerify(
  wallet: string,
  message: string,
  signature: string
): Promise<VerifyResponse> {
  return postJSON<VerifyResponse>("/api/auth/verify", { wallet, message, signature });
}

// ============================================================================
// 2) DIAMOND SIGNUP - For new wallet-native Diamond users
// ============================================================================

/**
 * Get a challenge for Diamond signup (cookie-based challenge)
 * This purpose allows account creation in /api/auth/verify
 */
export async function diamondSignupChallenge(wallet: string): Promise<ChallengeResponse> {
  return postJSON<ChallengeResponse>("/api/auth/challenge", { wallet, purpose: "DIAMOND_SIGNUP" });
}

/**
 * Verify signature for Diamond signup (desktop web flow)
 * Creates user if purpose cookie is DIAMOND_SIGNUP
 */
export async function diamondSignupVerify(
  wallet: string,
  message: string,
  signature: string,
  refCode?: string
): Promise<VerifyResponse> {
  return postJSON<VerifyResponse>("/api/auth/verify", { wallet, message, signature, refCode });
}

/**
 * Start Diamond subscription (after verify on desktop)
 * Sets subscription to DIAMOND + PENDING
 */
export async function diamondStart(): Promise<SimpleResponse> {
  return postJSON<SimpleResponse>("/api/auth/diamond/start", {});
}

/**
 * Combined verify + start for iOS (avoids cookie drop between calls)
 * Use this instead of separate verify + start on iOS
 */
export async function diamondVerifyAndStartIOS(
  wallet: string,
  message: string,
  signature: string,
  refCode?: string
): Promise<VerifyResponse & { alreadyActive?: boolean }> {
  return postJSON("/api/auth/diamond/verify-and-start", { wallet, message, signature, refCode });
}

/**
 * Complete Diamond signup flow with automatic iOS detection
 */
export async function completeDiamondSignup(
  wallet: string,
  message: string,
  signature: string,
  refCode?: string
): Promise<{ ok: boolean; error?: string; alreadyActive?: boolean }> {
  if (isIOS()) {
    // iOS: use combined endpoint to avoid cookie drop
    return diamondVerifyAndStartIOS(wallet, message, signature, refCode);
  } else {
    // Desktop: verify then start
    const verifyRes = await diamondSignupVerify(wallet, message, signature, refCode);
    if (!verifyRes.ok) return verifyRes;
    return diamondStart();
  }
}

// ============================================================================
// 3) PAYOUT LINK - For Members linking solWallet for rewards
// ============================================================================

/**
 * Get a challenge for payout wallet linking (DB-based challenge)
 * Requires authenticated Member session
 * This is for solWallet only - NOT for auth
 */
export async function payoutLinkChallenge(): Promise<ChallengeResponse> {
  return postJSON<ChallengeResponse>("/api/auth/wallet-link/challenge", {});
}

/**
 * Verify signature and link payout wallet
 * Only sets solWallet, NOT walletAddress
 * Requires active Member subscription
 */
export async function payoutLinkVerify(
  wallet: string,
  signature: string,
  nonce: string
): Promise<SimpleResponse & { wallet?: string }> {
  return postJSON("/api/auth/wallet-link/verify", { wallet, signature, nonce });
}

// ============================================================================
// 4) DIAMOND UPGRADE - For Members converting to Diamond
// ============================================================================

/**
 * Get a challenge for Member → Diamond upgrade (DB-based challenge)
 * Requires authenticated Member session with eligible subscription
 */
export async function diamondUpgradeChallenge(): Promise<ChallengeResponse> {
  return postJSON<ChallengeResponse>("/api/auth/diamond/upgrade-challenge", {});
}

/**
 * Verify signature and upgrade to Diamond
 * Sets walletAddress (auth identity) on existing user
 * Sets subscription to DIAMOND + PENDING
 * User then proceeds to payment
 */
export async function diamondUpgradeVerify(
  wallet: string,
  signature: string,
  nonce: string
): Promise<SimpleResponse> {
  return postJSON<SimpleResponse>("/api/auth/diamond/upgrade", { wallet, signature, nonce });
}

// ============================================================================
// Session utilities
// ============================================================================

/**
 * Fetch current user session
 */
export async function fetchMe(): Promise<{
  ok: boolean;
  authed: boolean;
  user?: {
    id: string;
    email?: string;
    walletAddress?: string;
    solWallet?: string;
    role: string;
  };
  membership?: string;
  tier?: string;
  sub?: {
    tier: string;
    status: string;
    expiresAt?: string;
  };
}> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  return res.json();
}

/**
 * Poll /api/auth/me until session is established or timeout
 * Useful after wallet auth on iOS where cookies may take time to stick
 */
export async function settleAuthMe(options: {
  maxAttempts?: number;
  delayMs?: number;
  requireTier?: boolean; // If true, requires tier !== "free"
} = {}): Promise<boolean> {
  const { maxAttempts = 8, delayMs = 400, requireTier = false } = options;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const data = await fetchMe();
      if (data.ok && data.authed) {
        if (!requireTier) return true;
        if (data.tier && data.tier !== "free") return true;
      }
    } catch {
      // Ignore fetch errors, retry
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

// ============================================================================
// Error code helpers
// ============================================================================

export const WalletAuthErrors = {
  WALLET_NOT_REGISTERED: "WALLET_NOT_REGISTERED",
  WALLET_NOT_LINKED: "WALLET_NOT_LINKED",
  WALLET_ALREADY_LINKED: "WALLET_ALREADY_LINKED",
  MEMBERSHIP_REQUIRED: "MEMBERSHIP_REQUIRED",
  WRONG_CHALLENGE_PURPOSE: "Wrong challenge purpose",
} as const;

/**
 * Check if error indicates wallet is not registered (needs Diamond signup)
 */
export function isWalletNotRegistered(error: string): boolean {
  return error === WalletAuthErrors.WALLET_NOT_REGISTERED;
}

/**
 * Check if error indicates wallet is only linked as payout (needs Diamond upgrade)
 */
export function isWalletNotLinkedForAuth(error: string): boolean {
  return error === WalletAuthErrors.WALLET_NOT_LINKED;
}

/**
 * Check if error indicates user needs Member subscription
 */
export function isMembershipRequired(error: string): boolean {
  return error === WalletAuthErrors.MEMBERSHIP_REQUIRED;
}
