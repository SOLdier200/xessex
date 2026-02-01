/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 *
 * iOS-safe wallet auth flow
 * - Rehydrate first (nonce-based, best for iOS)
 * - Fallback to verify
 * - Poll /me until session confirms
 */

import bs58 from "bs58";

type MeResponse = {
  ok: boolean;
  authed: boolean;
  tier: "free" | "member" | "diamond";
};

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { accept: "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

async function fetchMe() {
  const r = await fetchJSON("/api/auth/me", { method: "GET" });
  const me = r.data as MeResponse | null;
  return { ok: !!(r.ok && me?.ok), me };
}

async function signBase58(wallet: any, message: string) {
  const msgBytes = new TextEncoder().encode(message);
  const sigBytes: Uint8Array = await wallet.signMessage(msgBytes);
  return bs58.encode(sigBytes);
}

async function tryRehydrate(wallet: any, pub: string) {
  // 1) nonce
  const nonceResp = await fetchJSON("/api/auth/wallet/nonce", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet: pub }),
  });

  if (!nonceResp.ok || !nonceResp.data?.ok || !nonceResp.data?.nonce) return false;

  const nonce = String(nonceResp.data.nonce);
  const msg = `Rehydrate Xessex session\nHost: ${window.location.host}\nWallet: ${pub}\nNonce: ${nonce}`;
  const signature = await signBase58(wallet, msg);

  const reh = await fetchJSON("/api/auth/rehydrate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet: pub, nonce, signature }),
  });

  return !!(reh.ok && reh.data?.ok);
}

async function tryVerify(wallet: any, pub: string): Promise<{ ok: boolean; isNewUser?: boolean }> {
  const msg = `Sign in to Xessex\nHost: ${window.location.host}\nWallet: ${pub}\nTS: ${Date.now()}`;
  const signature = await signBase58(wallet, msg);

  const v = await fetchJSON("/api/auth/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet: pub, message: msg, signature }),
  });

  if (v.ok && v.data?.ok) {
    return { ok: true, isNewUser: v.data?.isNewUser === true };
  }
  return { ok: false };
}

async function pollMe(maxMs: number) {
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    const { ok, me } = await fetchMe();
    if (ok && me && me.authed && me.tier !== "free") return true;
    await sleep(250);
  }
  return false;
}

/**
 * iOS-safe session sync for wallet users.
 *
 * IMPORTANT: Use mode: "auto" for background/hook calls (NEVER signs)
 *            Use mode: "manual" for user-initiated sign-in (can sign)
 *
 * Auto mode (default):
 * - Checks /api/auth/me
 * - Waits for cookie settle
 * - Re-checks /api/auth/me
 * - NEVER triggers signMessage() - prevents iOS infinite loop
 *
 * Manual mode:
 * - Checks /api/auth/me
 * - Attempts rehydrate (nonce-based) or verify (fallback)
 * - Polls /api/auth/me until tier flips
 */
export async function syncWalletSession(
  wallet: any,
  opts?: { mode?: "auto" | "manual" }
) {
  const mode = opts?.mode ?? "auto";

  if (!wallet?.connected || !wallet?.publicKey) {
    return { ok: false, reason: "wallet_not_ready" as const };
  }

  const pub = wallet.publicKey.toBase58();

  // Already good?
  {
    const { ok, me } = await fetchMe();
    if (ok && me && me.authed && me.tier !== "free") {
      return { ok: true, didAuth: false as const };
    }
  }

  // 🚨 AUTO MODE: NEVER SIGN - only passive cookie check
  // This prevents infinite loops on iOS where Phantom returns and page remounts
  if (mode === "auto") {
    // Give iOS cookies a moment to settle after Phantom deep-link return
    await sleep(isIOS() ? 1500 : 500);

    const { ok, me } = await fetchMe();
    if (ok && me && me.authed && me.tier !== "free") {
      return { ok: true, didAuth: true as const };
    }
    // Can't fix passively - user must click sign-in button
    return { ok: false, reason: "needs_user_click" as const };
  }

  // MANUAL MODE: allowed to sign (user clicked a button)
  if (!wallet?.signMessage) {
    return { ok: false, reason: "wallet_cant_sign" as const };
  }

  // iOS can need 2 attempts due to WebView/cookie weirdness
  const attempts = isIOS() ? 2 : 1;

  for (let i = 0; i < attempts; i++) {
    // Preferred: rehydrate (nonce-based) - existing users only
    const rehOk = await tryRehydrate(wallet, pub);
    if (rehOk && (await pollMe(isIOS() ? 3000 : 1500))) {
      return { ok: true, didAuth: true as const, isNewUser: false };
    }

    // Fallback: verify (can create new users)
    const verifyResult = await tryVerify(wallet, pub);
    if (verifyResult.ok && (await pollMe(isIOS() ? 3000 : 1500))) {
      return { ok: true, didAuth: true as const, isNewUser: verifyResult.isNewUser ?? false };
    }
  }

  return { ok: false, reason: "still_free" as const };
}
