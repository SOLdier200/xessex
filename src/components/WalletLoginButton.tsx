"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

type MeUser = {
  id: string;
  email?: string | null;
  solWallet?: string | null;
  walletAddress?: string | null;
};

function detectPlatform() {
  if (typeof navigator === "undefined") return { isAndroid: false, isIos: false };
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = ua.includes("android");
  const isIos =
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    (ua.includes("mac") && (navigator as any).maxTouchPoints > 1);
  return { isAndroid, isIos };
}

export default function WalletLoginButton() {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const platform = useMemo(detectPlatform, []);

  const [status, setStatus] = useState("");
  const [me, setMe] = useState<MeUser | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  // Fetch current user on mount
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setMe(d.user ?? null);
        setLoadingMe(false);
      })
      .catch(() => setLoadingMe(false));
  }, []);

  // Refresh me when auth changes
  useEffect(() => {
    const handler = () => {
      fetch("/api/auth/me", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setMe(d.user ?? null))
        .catch(() => {});
    };
    window.addEventListener("auth-changed", handler);
    return () => window.removeEventListener("auth-changed", handler);
  }, []);

  const walletAddr = wallet.publicKey?.toBase58();
  const isLinked =
    me &&
    walletAddr &&
    (me.solWallet === walletAddr || me.walletAddress === walletAddr);

  const openInPhantom = () => {
    if (typeof window === "undefined") return;
    const url = encodeURIComponent(window.location.href);
    const ref = encodeURIComponent(window.location.origin);
    window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
  };

  // Sign in with wallet (creates wallet-native account or logs in)
  async function signInWithWallet() {
    if (!wallet.publicKey || !wallet.signMessage) {
      setStatus("Connect a wallet that supports message signing.");
      return;
    }

    try {
      setStatus("Requesting challenge...");
      const c = await fetch("/api/auth/challenge", { method: "POST" }).then((r) => r.json());

      setStatus("Signing...");
      const msgBytes = new TextEncoder().encode(c.message);
      const signed = await wallet.signMessage(msgBytes);

      const bs58 = (await import("bs58")).default;
      const signature = bs58.encode(signed);

      setStatus("Verifying...");
      const resp = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: wallet.publicKey.toBase58(),
          message: c.message,
          signature,
        }),
      });

      const v = await resp.json();

      if (!v.ok) {
        setStatus(v.error || "Login failed");
        return;
      }

      setStatus("Logged in!");
      window.dispatchEvent(new Event("auth-changed"));
      window.location.href = "/";
    } catch (e: any) {
      setStatus(e?.message || "Wallet login failed");
    }
  }

  // Link wallet to existing account
  async function linkWalletToAccount() {
    if (!wallet.publicKey || !wallet.signMessage) {
      setStatus("Connect a wallet that supports message signing.");
      return;
    }

    try {
      setStatus("Requesting challenge...");
      const challengeRes = await fetch("/api/auth/wallet-link/challenge", { method: "POST" });
      const challengeData = await challengeRes.json();

      if (!challengeData.ok) throw new Error(challengeData.error || "Failed to get challenge");

      const { message, nonce } = challengeData;

      setStatus("Signing...");
      const msgBytes = new TextEncoder().encode(message);
      const signature = await wallet.signMessage(msgBytes);

      const bs58 = (await import("bs58")).default;
      const signatureB58 = bs58.encode(signature);

      setStatus("Verifying...");
      const verifyRes = await fetch("/api/auth/wallet-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: wallet.publicKey.toBase58(),
          signature: signatureB58,
          nonce,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.ok) throw new Error(verifyData.error || "Failed to verify signature");

      setStatus("Wallet linked!");
      window.dispatchEvent(new Event("auth-changed"));

      // Refresh me to update UI
      const fresh = await fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json());
      setMe(fresh.user ?? null);
      setStatus("");
    } catch (e: any) {
      setStatus(e?.message || "Link failed");
    }
  }

  return (
    <div className="space-y-3">
      {/* iOS helper hint */}
      {platform.isIos && !wallet.connected && (
        <div className="text-xs text-white/60 mb-2">
          iOS tip: for the best experience, open this site in Phantom's browser.
        </div>
      )}

      {/* STATE 1: Wallet not connected */}
      {!wallet.connected && (
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
            Connect Wallet
          </button>

          {platform.isIos && (
            <button
              onClick={openInPhantom}
              className="w-full py-3 px-6 rounded-full font-semibold text-white/90 transition border border-white/20 bg-white/10 hover:bg-white/15"
            >
              Open in Phantom (iOS)
            </button>
          )}
        </>
      )}

      {/* STATE 2: Wallet connected, NOT logged in -> Sign in with wallet */}
      {wallet.connected && !loadingMe && !me && (
        <div className="space-y-2">
          <div className="text-sm text-white/60">
            Connected: {walletAddr?.slice(0, 4)}...{walletAddr?.slice(-4)}
          </div>
          <button
            onClick={signInWithWallet}
            className="w-full py-3 px-6 rounded-xl bg-pink-500 font-semibold text-black hover:bg-pink-400 transition"
          >
            Sign in with Wallet
          </button>
          <button
            onClick={() => wallet.disconnect()}
            className="w-full py-2 px-4 rounded-xl bg-white/10 border border-white/20 text-white/70 hover:bg-white/20 transition text-sm"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* STATE 3: Wallet connected, logged in, NOT linked -> Link wallet */}
      {wallet.connected && !loadingMe && me && !isLinked && (
        <div className="space-y-2">
          <div className="text-sm text-white/60">
            Connected: {walletAddr?.slice(0, 4)}...{walletAddr?.slice(-4)}
          </div>
          <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-3">
            <div className="text-yellow-200 text-sm font-medium">Wallet not linked</div>
            <div className="text-white/60 text-xs mt-1">
              Link this wallet to your account to enable on-chain features.
            </div>
          </div>
          <button
            onClick={linkWalletToAccount}
            className="w-full py-3 px-6 rounded-xl bg-yellow-400 font-semibold text-black hover:bg-yellow-300 transition"
          >
            Link Wallet to Account
          </button>
          <button
            onClick={() => wallet.disconnect()}
            className="w-full py-2 px-4 rounded-xl bg-white/10 border border-white/20 text-white/70 hover:bg-white/20 transition text-sm"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* STATE 4: Wallet connected, logged in, IS linked -> All good! */}
      {wallet.connected && !loadingMe && me && isLinked && (
        <div className="space-y-2">
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
            <div className="text-emerald-200 text-sm font-medium">Wallet linked</div>
            <div className="text-white/60 text-xs mt-1 font-mono">
              {walletAddr?.slice(0, 4)}...{walletAddr?.slice(-4)}
            </div>
          </div>
          <button
            onClick={() => wallet.disconnect()}
            className="w-full py-2 px-4 rounded-xl bg-white/10 border border-white/20 text-white/70 hover:bg-white/20 transition text-sm"
          >
            Disconnect Wallet
          </button>
        </div>
      )}

      {/* Loading state */}
      {wallet.connected && loadingMe && (
        <div className="text-sm text-white/50">Checking account...</div>
      )}

      {/* Status message */}
      {status && <div className="text-sm text-white/70">{status}</div>}
    </div>
  );
}
