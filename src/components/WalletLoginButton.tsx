"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { syncWalletSession } from "@/lib/walletAuthFlow";

export default function WalletLoginButton() {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [status, setStatus] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = ua.includes("android");
    const isIos =
      ua.includes("iphone") ||
      ua.includes("ipad") ||
      (ua.includes("mac") && navigator.maxTouchPoints > 1);
    setIsMobile(isAndroid || isIos);
  }, []);

  const openInPhantom = () => {
    if (typeof window === "undefined") return;
    const url = encodeURIComponent(window.location.href);
    const ref = encodeURIComponent(window.location.origin);
    window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
  };

  async function signIn() {
    if (!wallet.publicKey || !wallet.signMessage) {
      setStatus("Wallet does not support message signing.");
      return;
    }

    try {
      setStatus("Requesting challenge...");
      const c = await fetch("/api/auth/challenge", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      }).then((r) => r.json());

      setStatus("Signing...");
      const msgBytes = new TextEncoder().encode(c.message);
      const signed = await wallet.signMessage(msgBytes);

      const bs58 = (await import("bs58")).default;
      const signature = bs58.encode(signed);

      setStatus("Verifying...");
      const resp = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          wallet: wallet.publicKey.toBase58(),
          message: c.message,
          signature,
        }),
      });

      const v = await resp.json().catch(() => ({}));

      if (!resp.ok || !v.ok) {
        setStatus(v.error || "Login failed");
        return;
      }

      // 🔥 iOS-proof: ensure cookie/session actually sticks + /me flips
      setStatus("Syncing session...");
      const synced = await syncWalletSession(wallet as any);
      if (!synced.ok) {
        // Still dispatch so UI refreshes; user can hit sign-in again if needed
        window.dispatchEvent(new Event("auth-changed"));
        setStatus("Signed in, but session didn't fully sync. Tap sign-in again if needed.");
        return;
      }

      setStatus("Logged in!");
      window.dispatchEvent(new Event("auth-changed"));

      // Give Safari a moment to commit cookies before navigation
      setTimeout(() => {
        window.location.href = "/";
      }, 150);
    } catch (e: any) {
      setStatus(e?.message || "Login failed");
    }
  }

  return (
    <div className="space-y-3">
      {!wallet.connected ? (
        <>
          <button
            onClick={() => setVisible(true)}
            className="w-full py-3 px-6 rounded-full font-semibold text-white transition"
            style={{
              background: "linear-gradient(135deg, #9945FF 0%, #7B3FE4 100%)",
              border: "2px solid #FF1493",
              boxShadow: "0 0 12px rgba(255, 20, 147, 0.4)",
            }}
          >
            Select Wallet
          </button>
          {isMobile && (
            <button
              onClick={openInPhantom}
              className="w-full py-3 px-6 rounded-full font-semibold text-white/90 transition border border-white/20 bg-white/10 hover:bg-white/15"
            >
              Open in Phantom
            </button>
          )}
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={signIn}
            className="rounded-xl bg-pink-500 px-4 py-2 font-semibold text-black hover:bg-pink-400"
          >
            Sign in with wallet
          </button>
          <button
            onClick={() => wallet.disconnect()}
            className="rounded-xl bg-white/10 border border-white/20 px-4 py-2 font-semibold text-white/70 hover:bg-white/20 hover:text-white transition"
          >
            Disconnect Wallet
          </button>
        </div>
      )}
      {status && <div className="text-sm text-white/70">{status}</div>}
    </div>
  );
}
