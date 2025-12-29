"use client";

import { useState, useEffect } from "react";
import { ConnectionProvider, WalletProvider, useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import TopNav from "../components/TopNav";
import "@solana/wallet-adapter-react-ui/styles.css";

const TREASURY = process.env.NEXT_PUBLIC_SUB_TREASURY_WALLET || "";
const PRICE_SOL = parseFloat(process.env.NEXT_PUBLIC_SUB_PRICE_SOL || "0.05");

function SubscribeInner() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setStatus("Please connect your wallet first.");
      return;
    }

    if (!TREASURY) {
      setStatus("Treasury wallet not configured.");
      return;
    }

    setLoading(true);
    setStatus("Preparing transaction...");

    try {
      const lamports = Math.round(PRICE_SOL * LAMPORTS_PER_SOL);
      const treasuryPubkey = new PublicKey(TREASURY);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: treasuryPubkey,
          lamports,
        })
      );

      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = wallet.publicKey;

      setStatus("Please approve the transaction...");
      const signed = await wallet.signTransaction(tx);

      setStatus("Sending transaction...");
      const sig = await connection.sendRawTransaction(signed.serialize());

      setStatus("Confirming...");
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });

      // Redirect to confirm page with signature
      window.location.href = `/subscribe/confirm?sig=${sig}`;
    } catch (err: any) {
      console.error(err);
      setStatus(err.message || "Transaction failed");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl neon-border rounded-2xl p-6 bg-black/30">
      <h1 className="text-2xl font-semibold neon-text">Subscribe with Crypto</h1>
      <p className="mt-2 text-sm text-white/70">
        Pay {PRICE_SOL} SOL to unlock all premium videos for 30 days.
      </p>

      <div className="mt-6 space-y-4">
        <WalletMultiButton />

        {wallet.connected && (
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full rounded-xl bg-pink-500 px-4 py-3 font-semibold text-black hover:bg-pink-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : `Pay ${PRICE_SOL} SOL`}
          </button>
        )}

        {status && (
          <div className="text-sm text-white/70 bg-black/40 rounded-lg p-3">
            {status}
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-white/50">
        Your subscription will be activated immediately after payment confirmation.
      </p>
    </div>
  );
}

export default function SubscribePage() {
  const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10 flex justify-center">
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              <SubscribeInner />
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </div>
    </main>
  );
}
