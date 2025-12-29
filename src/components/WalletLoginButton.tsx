"use client";

import { useState } from "react";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

function InnerLogin() {
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
    window.location.href = "/";
  }

  return (
    <div className="space-y-3">
      <WalletMultiButton />
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

export default function WalletLoginButton() {
  const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <InnerLogin />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
