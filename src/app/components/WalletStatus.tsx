"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { usePathname } from "next/navigation";

type AuthData = {
  authed: boolean;
  membership: "DIAMOND" | "MEMBER" | "FREE";
  walletAddress: string | null;
};

export default function WalletStatus() {
  const { publicKey, connected } = useWallet();
  const pathname = usePathname();
  const [auth, setAuth] = useState<AuthData | null>(null);

  const fetchAuth = useCallback(() => {
    // Add cache buster to prevent stale responses
    fetch(`/api/auth/me?_=${Date.now()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.authed) {
          setAuth({ authed: true, membership: d.membership, walletAddress: d.walletAddress });
        } else {
          setAuth(null);
        }
      })
      .catch(() => setAuth(null));
  }, []);

  // Fetch on mount, wallet change, and navigation
  useEffect(() => {
    fetchAuth();
  }, [connected, pathname, fetchAuth]);

  const showWallet = connected && publicKey;
  const showMembership = auth?.authed && auth.membership !== "FREE";

  if (!showWallet && !showMembership) {
    return null;
  }

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : auth?.walletAddress
      ? `${auth.walletAddress.slice(0, 4)}...${auth.walletAddress.slice(-4)}`
      : null;

  return (
    <div className="flex flex-wrap gap-3">
      {/* Wallet Connected Box */}
      {showWallet && (
        <div className="neon-border rounded-2xl p-4 bg-gradient-to-r from-sky-500/20 to-purple-500/20 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-sky-400 animate-pulse" />
          <div>
            <div className="text-sm font-semibold text-sky-400">Wallet Connected</div>
            <div className="text-xs text-white/60">{shortAddress}</div>
          </div>
        </div>
      )}

      {/* Membership Box */}
      {showMembership && (
        <div
          className={`neon-border rounded-2xl p-4 flex items-center gap-3 ${
            auth.membership === "DIAMOND"
              ? "bg-gradient-to-r from-yellow-500/20 to-purple-500/20 border-yellow-400/50"
              : "bg-gradient-to-r from-sky-500/20 to-emerald-500/20 border-sky-400/50"
          }`}
        >
          <div
            className={`w-3 h-3 rounded-full animate-pulse ${
              auth.membership === "DIAMOND" ? "bg-yellow-400" : "bg-emerald-400"
            }`}
          />
          <div>
            <div
              className={`text-sm font-semibold ${
                auth.membership === "DIAMOND" ? "text-yellow-400" : "text-emerald-400"
              }`}
            >
              {auth.membership === "DIAMOND" ? "Diamond Member" : "Member"}
            </div>
            <div className="text-xs text-white/60">
              {auth.membership === "DIAMOND" ? "Premium Access" : "Full Access"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
