"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

export default function WalletLoginButton() {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [status, setStatus] = useState("");

  async function signIn() {
    if (!wallet.publicKey || !wallet.signMessage) {
      setStatus("Wallet does not support message signing.");
      return;
    }

    setStatus("Requesting challenge...");
    const c = await fetch("/api/auth/challenge", { method: "POST" }).then((r) => r.json());

    setStatus("Signing...");
    const msgBytes = new TextEncoder().encode(c.message);
    const signed = await wallet.signMessage(msgBytes);

    const bs58 = (await import("bs58")).default;
    const signature = bs58.encode(signed);

    setStatus("Verifying...");
    const v = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        wallet: wallet.publicKey.toBase58(),
        message: c.message,
        signature,
      }),
    }).then((r) => r.json());

    if (!v.ok) {
      setStatus(v.error || "Login failed");
      return;
    }

    setStatus("Logged in!");
    // Notify other components (like WalletStatus) that auth changed
    window.dispatchEvent(new Event("auth-changed"));
    window.location.href = "/";
  }

  return (
    <div className="space-y-3">
      {!wallet.connected ? (
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
