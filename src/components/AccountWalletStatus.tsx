"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

type AuthMe = {
  authed: boolean;
  membership?: "DIAMOND" | "MEMBER" | "FREE";
  walletAddress?: string | null;
  email?: string | null;
};

function shortAddress(addr?: string | null) {
  if (!addr) return "";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export default function AccountWalletStatus() {
  const { publicKey, connected } = useWallet();
  const [auth, setAuth] = useState<AuthMe | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(() => {
    setLoading(true);
    fetch(`/api/auth/me?_=${Date.now()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d?.authed) {
          setAuth({
            authed: true,
            membership: d.membership,
            walletAddress: d.walletAddress ?? null,
            email: d.email ?? null,
          });
        } else {
          setAuth({ authed: false });
        }
      })
      .catch(() => setAuth({ authed: false }))
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
  const linkedWallet = auth?.walletAddress ?? null;
  const linkedMatches =
    !!connectedWallet && !!linkedWallet && connectedWallet === linkedWallet;

  let linkedText = "No account";
  if (!loading && auth?.authed) {
    if (linkedWallet) {
      const detail = `account wallet ${shortAddress(linkedWallet)}`;
      if (connectedWallet) {
        linkedText = linkedMatches ? `Yes (${detail})` : `No (${detail})`;
      } else {
        linkedText = `Yes (${detail})`;
      }
    } else {
      linkedText = "No (no linked wallet)";
    }
  }

  const accountLabel = loading
    ? "Loading..."
    : auth?.authed
    ? auth?.email || `Signed in (${auth?.membership ?? "FREE"})`
    : "Not signed in";

  const walletLabel = connected && connectedWallet
    ? shortAddress(connectedWallet)
    : "Not connected";

  return (
    <div className="neon-border rounded-2xl p-4 bg-black/30 text-sm space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-white/60">Account</span>
        <span className="text-white/90 font-semibold">{accountLabel}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-white/60">Wallet</span>
        <span className="text-white/90 font-semibold">{walletLabel}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-white/60">Linked</span>
        <span className="text-white/90 font-semibold">{loading ? "Loading..." : linkedText}</span>
      </div>
    </div>
  );
}
