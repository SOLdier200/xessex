/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 *
 * iOS Wallet Session Rehydration
 *
 * On iOS, wallet app → browser transitions often lose cookies.
 * This module detects that scenario and re-establishes the session
 * by having the user sign a fresh challenge.
 */

import bs58 from "bs58";

type WalletLike = {
  publicKey?: { toBase58(): string } | null;
  signMessage?: (msg: Uint8Array) => Promise<Uint8Array>;
  connected?: boolean;
};

/**
 * Detects if we're on iOS Safari or in-app browser
 */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

/**
 * Attempts to rehydrate session when:
 * - Wallet is connected
 * - But site thinks user is FREE / not authed
 *
 * Returns true if session was successfully rehydrated.
 */
export async function rehydrateSessionIfNeeded(
  wallet: WalletLike,
  authStatus: { authed: boolean; tier?: string }
): Promise<boolean> {
  // Only proceed if wallet is connected but auth is missing/free
  if (!wallet?.connected || !wallet?.publicKey || !wallet?.signMessage) {
    return false;
  }

  // If already authed and not FREE, no need to rehydrate
  if (authStatus.authed && authStatus.tier && authStatus.tier !== "FREE") {
    return false;
  }

  // Optional: Only do this on iOS (remove this check to do it everywhere)
  // if (!isIOS()) return false;

  try {
    const pub = wallet.publicKey.toBase58();

    // 1) Get nonce
    const nonceRes = await fetch("/api/auth/wallet/nonce", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ wallet: pub }),
    }).then((r) => r.json());

    if (!nonceRes.ok) {
      console.warn("[rehydrate] Failed to get nonce:", nonceRes.error);
      return false;
    }

    const nonce = nonceRes.nonce as string;

    // 2) Build message (must match server exactly)
    const message = `Rehydrate Xessex session\nHost: ${window.location.host}\nWallet: ${pub}\nNonce: ${nonce}`;
    const msgBytes = new TextEncoder().encode(message);

    // 3) Sign
    const sigBytes = await wallet.signMessage(msgBytes);
    const signature = bs58.encode(sigBytes);

    // 4) Submit to rehydrate endpoint
    const rehRes = await fetch("/api/auth/rehydrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ wallet: pub, nonce, signature }),
    }).then((r) => r.json());

    if (rehRes.ok) {
      console.log("[rehydrate] Session restored successfully");
      return true;
    } else {
      console.warn("[rehydrate] Failed:", rehRes.error);
      return false;
    }
  } catch (err) {
    console.error("[rehydrate] Error:", err);
    return false;
  }
}

/**
 * Full rehydration flow with auth refresh
 */
export async function rehydrateAndRefresh(
  wallet: WalletLike,
  authStatus: { authed: boolean; tier?: string },
  refreshAuth: () => Promise<void>
): Promise<boolean> {
  const rehydrated = await rehydrateSessionIfNeeded(wallet, authStatus);
  if (rehydrated) {
    // Refresh auth state from /api/auth/me
    await refreshAuth();
    // Dispatch event so other components can react
    window.dispatchEvent(new Event("auth-changed"));
  }
  return rehydrated;
}
