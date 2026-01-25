/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 *
 * Hook: Auto-fix wallet session on iOS
 * Runs automatically on connect and fixes iOS session issues invisibly.
 * Dispatches 'auth-changed' event when session is fixed.
 */

import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { syncWalletSession } from "@/lib/walletAuthFlow";

export function useWalletSessionAutoFix(
  auth: { authed: boolean; tier: "free" | "member" | "diamond" } | null
) {
  const wallet = useWallet();
  const running = useRef(false);
  const lastPub = useRef("");

  useEffect(() => {
    (async () => {
      if (running.current) return;
      if (!wallet.connected || !wallet.publicKey) return;

      // If we don't have auth yet, don't spam signatures (wait for fetchAuth)
      if (!auth) return;

      // Only attempt fix if connected but app thinks FREE/unauthed
      if (auth.authed && auth.tier !== "free") return;

      const pub = wallet.publicKey.toBase58();
      // Avoid repeated prompts for same wallet
      if (lastPub.current === pub) return;
      lastPub.current = pub;

      running.current = true;
      try {
        const res = await syncWalletSession(wallet as any);
        if (res.ok) {
          window.dispatchEvent(new Event("auth-changed"));
        }
      } finally {
        running.current = false;
      }
    })();
  }, [wallet.connected, wallet.publicKey?.toBase58(), auth?.authed, auth?.tier]);
}
