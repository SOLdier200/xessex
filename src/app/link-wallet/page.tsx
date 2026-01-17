"use client";

import TopNav from "../components/TopNav";
import SolanaProviders from "@/components/SolanaProviders";
import AccountWalletStatus from "@/components/AccountWalletStatus";
import WalletLoginButton from "@/components/WalletLoginButton";

function LinkWalletContent() {
  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      <div className="space-y-6">
        {/* Status panel */}
        <AccountWalletStatus />

        {/* Wallet actions */}
        <div className="neon-border rounded-2xl bg-black/80 p-6 md:p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Link Wallet</h1>
          <p className="text-white/60 mb-6">
            Connect and sign with your Solana wallet to link it to your account.
            This enables on-chain features and payments.
          </p>

          <WalletLoginButton />

          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-white/40">
              You can link one wallet per account. Linking proves you control the address by signing a message.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LinkWalletPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black">
      <TopNav />
      <SolanaProviders>
        <LinkWalletContent />
      </SolanaProviders>
    </div>
  );
}
