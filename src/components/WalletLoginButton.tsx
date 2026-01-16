"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

export default function WalletLoginButton() {
  const wallet = useWallet();
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
      <div className="wallet-button-wrapper">
        <WalletMultiButton />
      </div>
      <style jsx global>{`
        .wallet-button-wrapper .wallet-adapter-button {
          background: linear-gradient(135deg, #9945FF 0%, #7B3FE4 100%) !important;
          border-radius: 9999px !important;
          border: 2px solid #FF1493 !important;
          box-shadow: 0 0 12px rgba(255, 20, 147, 0.4) !important;
          padding: 12px 24px !important;
          font-weight: 600 !important;
          transition: all 0.2s ease !important;
        }
        .wallet-button-wrapper .wallet-adapter-button:hover {
          background: linear-gradient(135deg, #AB5CFF 0%, #8F4FEE 100%) !important;
          box-shadow: 0 0 20px rgba(255, 20, 147, 0.6) !important;
        }
        .wallet-button-wrapper .wallet-adapter-button-start-icon {
          margin-right: 8px !important;
        }
      `}</style>
      {wallet.connected && (
        <button
          onClick={signIn}
          className="rounded-xl bg-pink-500 px-4 py-2 font-semibold text-black hover:bg-pink-400"
        >
          Sign in with wallet
        </button>
      )}
      {status && <div className="text-sm text-white/70">{status}</div>}
    </div>
  );
}
