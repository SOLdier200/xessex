"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Image from "next/image";

type MeResp =
  | { ok: true; authed: false; user: null }
  | {
      ok: true;
      authed: true;
      membership: "DIAMOND" | "MEMBER" | "FREE";
      authWallet: string | null;
      payoutWallet: string | null;
      effectivePayoutWallet: string | null;
      needsAuthWalletLink: boolean;
      needsPayoutWalletLink: boolean;
      user: {
        id: string;
        email: string | null;
        role: "DIAMOND" | "MEMBER" | "FREE";
        
        walletAddress: string | null;
      };
    };

function shortAddress(addr?: string | null) {
  if (!addr) return "";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
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

  if (loading) {
    return (
      <div className="rounded-2xl p-4 bg-black/30 border border-white/10 text-sm">
        <div className="text-white/60 text-center">Loading...</div>
      </div>
    );
  }

  // Not signed in
  if (!me?.authed) {
    return (
      <div className="rounded-2xl p-4 bg-black/30 border border-white/20 text-sm">
        <div className="text-white/60 text-center">Not signed in</div>
      </div>
    );
  }

  const isDiamond = me.membership === "DIAMOND";
  const isMember = me.membership === "MEMBER";
  const authWallet = me.authWallet || me.user.walletAddress;
  const email = me.user.email;

  // Diamond Member - show diamond logo + wallet
  if (isDiamond) {
    return (
      <div className="rounded-2xl p-4 bg-black/30 border-2 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
        <div className="flex items-center gap-3">
          <Image
            src="/logos/textlogo/siteset3/diamond100.png"
            alt="Diamond Member"
            width={1536}
            height={282}
            className="h-[28px] w-auto"
          />
          <div className="flex-1 text-right">
            <div className="font-mono text-sm text-blue-300">
              {shortAddress(connectedWallet || authWallet)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Member - show member logo + email
  if (isMember) {
    return (
      <div className="rounded-2xl p-4 bg-black/30 border-2 border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.2)]">
        <div className="flex items-center gap-3">
          <Image
            src="/logos/textlogo/siteset3/member100.png"
            alt="Member"
            width={974}
            height={286}
            className="h-[28px] w-auto"
          />
          <div className="flex-1 text-right">
            <div className="text-sm text-pink-300 font-medium">
              {email || "Member"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Free user
  return (
    <div className="rounded-2xl p-4 bg-black/30 border border-white/20 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-white/60">Account</span>
        <span className="text-white/90 font-medium">{email || "Free User"}</span>
      </div>
    </div>
  );
}
