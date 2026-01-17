"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

type MeUser = {
  id: string;
  email?: string | null;
  role: string;
  solWallet?: string | null;
  walletAddress?: string | null;
};

function short(addr?: string | null) {
  if (!addr) return "";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function detectPlatform() {
  if (typeof navigator === "undefined") return { isIos: false, isAndroid: false };
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = ua.includes("android");
  const isIos =
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    (ua.includes("mac") && (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1);
  return { isIos, isAndroid };
}

export default function AccountWalletStatus() {
  const { connected, publicKey } = useWallet();
  const [me, setMe] = useState<MeUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  const pk = publicKey?.toBase58() ?? null;

  // Fetch user data
  async function refreshMe() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const d = await res.json();
      setMe(d?.user ?? null);
    } catch {
      setMe(null);
    } finally {
      setLoaded(true);
    }
  }

  // Initial fetch
  useEffect(() => {
    refreshMe();
  }, []);

  // Listen for auth changes (login/logout)
  useEffect(() => {
    const onAuthChanged = () => refreshMe();
    window.addEventListener("auth-changed", onAuthChanged);
    return () => window.removeEventListener("auth-changed", onAuthChanged);
  }, []);

  const isAuthed = !!me;
  const isLinked =
    !!me &&
    !!pk &&
    (me.solWallet === pk || me.walletAddress === pk);

  const linkedWalletOnAccount = me?.solWallet || me?.walletAddress || null;
  const p = useMemo(detectPlatform, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-white/70">Account</span>
        {!loaded ? (
          <span className="text-white/50">Loading…</span>
        ) : isAuthed ? (
          <span className="text-emerald-300 font-semibold">
            {me?.email ? me.email : `Signed in (${me?.role})`}
          </span>
        ) : (
          <span className="text-red-300 font-semibold">Not signed in</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-white/70">Wallet</span>
        {connected && pk ? (
          <span className="text-emerald-300 font-semibold font-mono">
            {short(pk)}
          </span>
        ) : (
          <span className="text-red-300 font-semibold">Not connected</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-white/70">Linked</span>
        {!isAuthed ? (
          <span className="text-white/40">—</span>
        ) : isLinked ? (
          <span className="text-emerald-300 font-semibold">Yes</span>
        ) : linkedWalletOnAccount ? (
          <span className="text-yellow-300 font-semibold">
            No (account has {short(linkedWalletOnAccount)})
          </span>
        ) : (
          <span className="text-yellow-300 font-semibold">No</span>
        )}
      </div>

      {(p.isIos || p.isAndroid) && (
        <div className="pt-2 border-t border-white/10 text-xs text-white/50">
          {p.isIos
            ? "iOS tip: wallet connect works best inside Phantom/Solflare in-app browser."
            : "Android tip: wallet connect works best in Chrome."}
        </div>
      )}
    </div>
  );
}
