"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import TopNav from "../components/TopNav";
import WalletActions from "@/components/WalletActions";

function detectIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    (ua.includes("mac") && (navigator as any).maxTouchPoints > 1)
  );
}

function LinkWalletContent() {
  const router = useRouter();
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();

  const ios = useMemo(detectIos, []);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [membership, setMembership] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const ok = !!d?.user;
        setAuthed(ok);
        setMembership(d?.membership ?? null);
        if (!ok) router.push("/login?next=/link-wallet");
      })
      .catch(() => {
        setAuthed(false);
        router.push("/login?next=/link-wallet");
      });
  }, [router]);

  if (authed === null) {
    return (
      <main className="max-w-lg mx-auto px-4 py-12 text-white/60">Loading…</main>
    );
  }

  // Members cannot link wallets - must upgrade to Diamond first
  if (membership === "MEMBER") {
    return (
      <main className="max-w-lg mx-auto px-4 py-12 space-y-6">
        <div className="neon-border rounded-2xl bg-black/80 p-6 md:p-8 border-sky-400/50">
          <h1 className="text-2xl font-bold text-sky-400 mb-4">Upgrade to Diamond Required</h1>
          <p className="text-white/70 mb-6">
            Wallet linking is a <span className="text-sky-300 font-medium">Diamond member</span> feature.
            Upgrade to Diamond to connect your wallet and earn XESS rewards.
          </p>
          <button
            onClick={() => router.push("/signup")}
            className="w-full py-3 px-6 rounded-xl bg-sky-500/20 border border-sky-400/50 text-sky-300 font-semibold hover:bg-sky-500/30 transition"
          >
            Upgrade to Diamond
          </button>
          <div className="mt-4 pt-4 border-t border-white/10">
            <button
              onClick={() => router.push("/")}
              className="w-full py-3 px-6 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 transition"
            >
              Back to Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-12 space-y-6">
      <div className="neon-border rounded-2xl bg-black/80 p-6 md:p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Set Payout Wallet <span className="text-white/50 text-base font-normal">(optional)</span></h1>
        <p className="text-white/60 mb-6">
          This is where <span className="text-green-400 font-medium">XESS rewards</span> get sent. Defaults to your auth wallet if not set. You&apos;ll sign a message - no transaction.
        </p>

        {!connected && (
          <button
            onClick={() => setVisible(true)}
            className="w-full py-3 px-6 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/15 transition"
          >
            Connect Wallet
          </button>
        )}

        {ios && (
          <div className="mt-3 text-xs text-white/50">
            iOS tip: if wallet connect fails in Safari, open xessex.me inside Phantom/Solflare's in-app browser.
          </div>
        )}

        <div className="mt-6">
          {/* On this page we only care about linking (not wallet-native sign-in). */}
          <WalletActions showWalletSignIn={false} />
        </div>

        <div className="mt-6 pt-4 border-t border-white/10">
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 px-6 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}

export default function LinkWalletPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black">
      <TopNav />
      <LinkWalletContent />
    </div>
  );
}
