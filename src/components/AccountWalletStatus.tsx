"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

type MeResp =
  | { ok: true; authed: false; user: null }
  | {
      ok: true;
      authed: true;
      membership: "DIAMOND" | "MEMBER" | "FREE";
      user: {
        id: string;
        email: string | null;
        role: "DIAMOND" | "MEMBER" | "FREE";
        solWallet: string | null;     // payout
        walletAddress: string | null; // auth
      };
    };

function shortAddress(addr?: string | null) {
  if (!addr) return "";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function matchLabel(connected?: string | null, target?: string | null) {
  if (!target) return "Not linked";
  if (!connected) return `Linked (${shortAddress(target)})`;
  return connected === target
    ? `Yes (${shortAddress(target)})`
    : `No (${shortAddress(target)})`;
}

export default function AccountWalletStatus() {
  const { publicKey, connected } = useWallet();

  const [me, setMe] = useState<MeResp | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(() => {
    setLoading(true);
    fetch(`/api/auth/me?_=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: MeResp) => setMe(d))
      .catch(() => setMe({ ok: true, authed: false, user: null }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    const handleAuthChange = () => fetchMe();
    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, [fetchMe]);

  const connectedWallet = publicKey?.toBase58() ?? null;

  const accountLabel = loading
    ? "Loading..."
    : me?.authed
    ? me.user.email
      ? `${me.user.email} (${me.membership})`
      : `Signed in (${me.membership})`
    : "Not signed in";

  const walletLabel =
    connected && connectedWallet ? shortAddress(connectedWallet) : "Not connected";

  const authWallet = me?.authed ? me.user.walletAddress : null;
  const payoutWallet = me?.authed ? me.user.solWallet : null;

  return (
    <div className="neon-border rounded-2xl p-4 bg-black/30 text-sm space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-white/60">Account</span>
        <span className="text-white/90 font-semibold">{accountLabel}</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-white/60">Connected wallet</span>
        <span className="text-white/90 font-semibold">{walletLabel}</span>
      </div>

      <div className="pt-2 border-t border-white/10 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-white/60">Auth wallet (login)</span>
          <span className="text-white/90 font-semibold">
            {loading ? "Loading..." : matchLabel(connectedWallet, authWallet)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-white/60">Payout wallet (rewards)</span>
          <span className="text-white/90 font-semibold">
            {loading ? "Loading..." : matchLabel(connectedWallet, payoutWallet)}
          </span>
        </div>
      </div>
    </div>
  );
}
