"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function WalletTestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-6 rounded-2xl border border-white/10 bg-black/40">
        <div className="text-white mb-4 font-semibold">Wallet Test</div>
        <WalletMultiButton />
      </div>
    </div>
  );
}
