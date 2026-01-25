/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 *
 * Hook: Auto-fix wallet session on iOS
 * Runs automatically on connect and fixes iOS session issues invisibly.
 */

import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ensureWalletSession } from "@/lib/walletAuthFlow";

export function useEnsureWalletSession(params: {
  authed: boolean;
  tier: "free" | "member" | "diamond";
  refreshMe: () => Promise<void>;
}) {
  const wallet = useWallet();
  const running = useRef(false);
  const last = useRef("");

  useEffect(() => {
    (async () => {
      if (running.current) return;
      if (!wallet.connected || !wallet.publicKey) return;

      const pub = wallet.publicKey.toBase58();
      if (last.current === pub && params.authed && params.tier !== "free") return;
      last.current = pub;

      // Only run if we look free/unauthed
      if (params.authed && params.tier !== "free") return;

      running.current = true;
      try {
        const r = await ensureWalletSession(wallet as any);
        if (r.ok) {
          await params.refreshMe();
          window.dispatchEvent(new Event("auth-changed"));
        }
      } finally {
        running.current = false;
      }
    })();
  }, [wallet.connected, wallet.publicKey?.toBase58(), params.authed, params.tier, params.refreshMe]);
}
