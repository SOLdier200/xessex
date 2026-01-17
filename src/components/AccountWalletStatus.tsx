"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";

type MeUser = {
  id: string;
  email?: string | null;
  solWallet?: string | null;
  walletAddress?: string | null;
  role?: string;
};

export default function AccountWalletStatus() {
  const { connected, publicKey } = useWallet();
  const [me, setMe] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setMe(d.user ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const walletAddr = publicKey?.toBase58();
  const linked =
    me &&
    walletAddr &&
    (me.solWallet === walletAddr || me.walletAddress === walletAddr);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-sm">
        <span className="text-white/50">Loading status...</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-sm space-y-2">
      <div>
        <b className="text-white/70">Account:</b>{" "}
        {me ? (
          <span className="text-green-400">{me.email || "Wallet account"}</span>
        ) : (
          <span className="text-red-400">Not logged in</span>
        )}
      </div>

      <div>
        <b className="text-white/70">Wallet:</b>{" "}
        {connected && walletAddr ? (
          <span className="text-green-400">
            Connected ({walletAddr.slice(0, 4)}...{walletAddr.slice(-4)})
          </span>
        ) : (
          <span className="text-red-400">Not connected</span>
        )}
      </div>

      {connected && walletAddr && (
        <div>
          <b className="text-white/70">Link:</b>{" "}
          {linked ? (
            <span className="text-green-400">Linked to account</span>
          ) : me ? (
            <span className="text-yellow-400">Not linked</span>
          ) : (
            <span className="text-gray-400">N/A (not logged in)</span>
          )}
        </div>
      )}
    </div>
  );
}
