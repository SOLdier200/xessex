/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 *
 * Hook: Auto-fix wallet session on iOS
 * Runs automatically on connect and fixes iOS session issues invisibly.
 * Dispatches 'auth-changed' event when session is fixed.
 *
 * IMPORTANT: Uses sessionStorage guard to survive iOS Phantom round-trip reloads.
 * Uses mode: "auto" which NEVER triggers signMessage() - prevents infinite loops.
 */

import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { syncWalletSession } from "@/lib/walletAuthFlow";

// Cooldown period - don't retry auto-fix for same wallet within this window
const COOLDOWN_MS = 60_000;

function storageKey(pub: string) {
  return `xessex_autofix_${pub}`;
}

// Check if we should run auto-fix for this wallet (survives iOS remounts)
function shouldRun(pub: string): boolean {
  try {
    const raw = sessionStorage.getItem(storageKey(pub));
    if (!raw) return true;
    const timestamp = Number(raw);
    if (!timestamp) return true;
    // Only run if cooldown has elapsed
    return Date.now() - timestamp > COOLDOWN_MS;
  } catch {
    return true;
  }
}

// Mark that we ran auto-fix for this wallet
function markRun(pub: string): void {
  try {
    sessionStorage.setItem(storageKey(pub), String(Date.now()));
  } catch {
    // sessionStorage not available (SSR, private mode, etc.)
  }
}

export function useWalletSessionAutoFix(
  auth: { authed: boolean; tier: "free" | "member" | "diamond" } | null
) {
  const wallet = useWallet();
  const running = useRef(false);

  useEffect(() => {
    (async () => {
      if (running.current) return;
      if (!wallet.connected || !wallet.publicKey) return;

      // If we don't have auth yet, don't do anything (wait for fetchAuth)
      if (!auth) return;

      // Only attempt fix if connected but app thinks FREE/unauthed
      if (auth.authed && auth.tier !== "free") return;

      const pub = wallet.publicKey.toBase58();

      // 🚨 CRITICAL: Use sessionStorage guard to survive iOS remounts/reloads
      // Refs reset on remount, but sessionStorage survives Phantom round-trips
      if (!shouldRun(pub)) return;
      markRun(pub);

      running.current = true;
      try {
        // 🚨 AUTO MODE: MUST NOT SIGN - only passive cookie check
        // This prevents the infinite "sign again" loop on iOS
        const res = await syncWalletSession(wallet as any, { mode: "auto" });

        if (res.ok) {
          window.dispatchEvent(new Event("auth-changed"));
        }
        // If res.reason === "needs_user_click", do nothing: user must press the button
      } finally {
        running.current = false;
      }
    })();
  }, [wallet.connected, wallet.publicKey?.toBase58(), auth?.authed, auth?.tier]);
}
