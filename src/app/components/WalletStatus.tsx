"use client";

import { useWallet } from "@solana/wallet-adapter-react";

export default function WalletStatus() {
  const { publicKey, connected } = useWallet();

  if (!connected || !publicKey) {
    return null;
  }

  const shortAddress = `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`;

  return (
    <div className="neon-border rounded-2xl p-4 bg-gradient-to-r from-sky-500/20 to-purple-500/20 flex items-center gap-3">
      <div className="w-3 h-3 rounded-full bg-sky-400 animate-pulse" />
      <div>
        <div className="text-sm font-semibold text-sky-400">User Connected</div>
        <div className="text-xs text-white/60">{shortAddress}</div>
      </div>
    </div>
  );
}
