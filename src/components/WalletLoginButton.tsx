"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

function platform() {
  if (typeof navigator === "undefined") return { isAndroid: false, isIos: false, isChromeAndroid: false };
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = ua.includes("android");
  const isIos =
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    (ua.includes("mac") && (navigator as any).maxTouchPoints > 1);
  const isChromeAndroid = isAndroid && ua.includes("chrome/");
  return { isAndroid, isIos, isChromeAndroid };
}

export default function WalletLoginButton() {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();

  const [status, setStatus] = useState("");
  const [needLinkWallet, setNeedLinkWallet] = useState<null | { wallet: string }>(null);
  const p = useMemo(platform, []);

  const openInPhantom = () => {
    if (typeof window === "undefined") return;
    const url = encodeURIComponent(window.location.href);
    const ref = encodeURIComponent(window.location.origin);
    window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
  };

  async function signIn() {
    setNeedLinkWallet(null);

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
        if (resp.status === 409 && v.error === "WALLET_NOT_LINKED") {
          // store for /link-wallet prefill if you want
          try {
            localStorage.setItem("pending_wallet_to_link", v.wallet || wallet.publicKey.toBase58());
          } catch {}
          setNeedLinkWallet({ wallet: v.wallet || wallet.publicKey.toBase58() });
          setStatus("");
          return;
        }

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

  async function switchAccountAndRetry() {
    setStatus("Logging out...");
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.reload();
  }

  return (
    <div className="space-y-3">
      {/* Helpful platform hints */}
      {p.isIos && (
        <div className="text-xs text-white/60">
          iOS tip: connect from inside Phantom/Solflare in-app browser for the best wallet experience.
        </div>
      )}
      {p.isAndroid && !p.isChromeAndroid && (
        <div className="text-xs text-white/60">
          Android tip: wallet connect works best in Chrome. If it fails here, try opening this page in Chrome.
        </div>
      )}

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

          {p.isIos && (
            <button
              onClick={openInPhantom}
              className="w-full py-3 px-6 rounded-full font-semibold text-white/90 transition border border-white/20 bg-white/10 hover:bg-white/15"
            >
              Open in Phantom (iOS)
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

      {/* 409 modal */}
      {needLinkWallet && (
        <div className="rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-4">
          <div className="font-semibold text-yellow-200">Wallet isn't linked to your current account</div>
          <div className="mt-1 text-sm text-white/70">
            Wallet <span className="font-mono text-white">{needLinkWallet.wallet}</span> is connected, but your session is for a different account.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/link-wallet"
              className="rounded-xl bg-yellow-400 px-4 py-2 font-semibold text-black hover:bg-yellow-300"
            >
              Link this wallet
            </a>
            <button
              onClick={switchAccountAndRetry}
              className="rounded-xl bg-white/10 border border-white/20 px-4 py-2 font-semibold text-white/80 hover:bg-white/20"
            >
              Switch account (log out)
            </button>
          </div>
        </div>
      )}

      {status && <div className="text-sm text-white/70">{status}</div>}
    </div>
  );
}
