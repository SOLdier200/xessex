"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import TopNav from "../components/TopNav";
import {
  fetchMe,
  diamondUpgradeChallenge,
  diamondUpgradeVerify,
  isIOS,
} from "@/lib/walletFlows";

function UpgradeToDiamondContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();

  const ios = useMemo(() => isIOS(), []);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [membership, setMembership] = useState<string | null>(null);
  const [subStatus, setSubStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [success, setSuccess] = useState(false);

  const next = useMemo(() => sp.get("next") || "/signup#diamond-card-crypto", [sp]);

  useEffect(() => {
    fetchMe()
      .then((d) => {
        const ok = !!d?.user;
        setAuthed(ok);
        setMembership(d?.membership ?? null);
        setSubStatus(d?.sub?.status ?? null);
        if (!ok) {
          router.push(`/login?next=${encodeURIComponent(`/upgrade-to-diamond?next=${encodeURIComponent(next)}`)}`);
        }
      })
      .catch(() => {
        setAuthed(false);
        router.push(`/login?next=${encodeURIComponent(`/upgrade-to-diamond?next=${encodeURIComponent(next)}`)}`);
      });
  }, [router, next]);

  // Check eligibility
  const isEligibleMember =
    membership === "MEMBER" &&
    (subStatus === "ACTIVE" || subStatus === "TRIAL" || subStatus === "PARTIAL");

  async function handleUpgrade() {
    if (!wallet.publicKey || !wallet.signMessage) {
      setStatus("Connect a wallet that supports message signing.");
      return;
    }

    setBusy(true);
    setStatus("Requesting upgrade challenge...");

    try {
      const challengeRes = await diamondUpgradeChallenge();
      if (!challengeRes.ok) {
        setStatus((challengeRes as any).error || "Failed to get challenge.");
        setBusy(false);
        return;
      }

      const { message, nonce } = challengeRes as { ok: true; message: string; nonce: string; expiresAt: string };

      setStatus("Please sign the message in your wallet...");
      const msgBytes = new TextEncoder().encode(message);
      const signatureBytes = await wallet.signMessage(msgBytes);
      const signature = bs58.encode(signatureBytes);

      setStatus("Upgrading to Diamond...");
      const verifyRes = await diamondUpgradeVerify(
        wallet.publicKey.toBase58(),
        signature,
        nonce!
      );

      if (!verifyRes.ok) {
        const err = (verifyRes as any).error;
        if (err === "WALLET_ALREADY_LINKED") {
          setStatus("This wallet is already linked to another account.");
        } else {
          setStatus(err || "Upgrade failed.");
        }
        setBusy(false);
        return;
      }

      setSuccess(true);
      setStatus("Upgraded! Redirecting to payment...");
      window.dispatchEvent(new Event("auth-changed"));

      setTimeout(() => {
        router.push(next);
      }, 1500);
    } catch (e: any) {
      setStatus(e?.message || "Upgrade failed.");
      setBusy(false);
    }
  }

  if (authed === null) {
    return <main className="max-w-lg mx-auto px-4 py-12 text-white/60">Loading...</main>;
  }

  // Already Diamond
  if (membership === "DIAMOND") {
    return (
      <main className="max-w-lg mx-auto px-4 py-12 space-y-6">
        <div className="neon-border rounded-2xl bg-black/80 p-6 md:p-8 border-cyan-400/50">
          <h1 className="text-2xl font-bold text-cyan-400 mb-4">Already Diamond!</h1>
          <p className="text-white/70 mb-6">
            You already have a Diamond membership. Enjoy your benefits!
          </p>
          <button
            onClick={() => router.push("/profile")}
            className="w-full py-3 px-6 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-semibold hover:bg-cyan-500/30 transition"
          >
            Go to Profile
          </button>
        </div>
      </main>
    );
  }

  // Not eligible (FREE or ineligible Member)
  if (!isEligibleMember) {
    return (
      <main className="max-w-lg mx-auto px-4 py-12 space-y-6">
        <div className="neon-border rounded-2xl bg-black/80 p-6 md:p-8 border-yellow-400/50">
          <h1 className="text-2xl font-bold text-yellow-400 mb-4">Member Subscription Required</h1>
          <p className="text-white/70 mb-6">
            You need an active <span className="text-yellow-300 font-medium">Member subscription</span> to
            upgrade to Diamond. This preserves your existing account history and rewards.
          </p>
          <button
            onClick={() => router.push("/signup")}
            className="w-full py-3 px-6 rounded-xl bg-yellow-500/20 border border-yellow-400/50 text-yellow-300 font-semibold hover:bg-yellow-500/30 transition"
          >
            Get Member Subscription
          </button>
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-white/50 text-sm text-center mb-3">
              Or create a new Diamond account with wallet
            </p>
            <button
              onClick={() => router.push("/signup#diamond-card-crypto")}
              className="w-full py-3 px-6 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-semibold hover:bg-cyan-500/30 transition"
            >
              New Diamond Signup
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Eligible Member - show upgrade UI
  return (
    <main className="max-w-lg mx-auto px-4 py-12 space-y-6">
      <div className="neon-border rounded-2xl bg-black/80 p-6 md:p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Upgrade to Diamond</h1>
        <p className="text-white/60 mb-6">
          Connect a wallet to upgrade your Member account to{" "}
          <span className="text-cyan-300 font-medium">Diamond</span>. Your existing
          comments, likes, and rewards will be preserved.
        </p>

        {!wallet.connected && (
          <>
            <button
              onClick={() => setVisible(true)}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold hover:from-purple-500 hover:to-violet-500 transition"
            >
              Connect Wallet
            </button>
            {ios && (
              <div className="mt-3 text-xs text-white/50">
                iOS tip: if wallet connect fails in Safari, open xessex.me inside
                Phantom/Solflare&apos;s in-app browser.
              </div>
            )}
          </>
        )}

        {wallet.connected && !success && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-green-500/50 bg-green-500/10">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <div>
                  <p className="text-green-400 font-medium">Wallet Connected</p>
                  <p className="text-white/60 text-sm font-mono">
                    {wallet.publicKey?.toBase58().slice(0, 4)}...
                    {wallet.publicKey?.toBase58().slice(-4)}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleUpgrade}
              disabled={busy}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold hover:from-cyan-500 hover:to-blue-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {status || "Working..."}
                </>
              ) : (
                "Upgrade to Diamond"
              )}
            </button>

            <button
              onClick={() => wallet.disconnect()}
              className="w-full py-2 text-sm text-white/50 hover:text-white/70 transition"
            >
              Disconnect Wallet
            </button>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-green-500/20 border border-green-500/50 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto mb-2 text-green-400"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-green-400 font-medium">Upgraded to Diamond!</p>
            <p className="text-white/60 text-sm mt-1">Redirecting to payment...</p>
          </div>
        )}

        {status && !busy && !success && (
          <div className="mt-4 text-sm text-center text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            {status}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-white/10">
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 px-6 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 transition"
          >
            Back to Home
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-400/30">
        <h3 className="text-cyan-400 font-medium text-sm mb-2">What happens when you upgrade?</h3>
        <ul className="text-white/60 text-xs space-y-1">
          <li>• Your wallet becomes your login identity</li>
          <li>• All your comments, likes, and rewards are preserved</li>
          <li>• You&apos;ll proceed to complete Diamond payment</li>
          <li>• Email login still works as backup</li>
        </ul>
      </div>
    </main>
  );
}

function UpgradeToDiamondInner() {
  return (
    <Suspense fallback={<main className="max-w-lg mx-auto px-4 py-12 text-white/60">Loading...</main>}>
      <UpgradeToDiamondContent />
    </Suspense>
  );
}

export default function UpgradeToDiamondPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black">
      <TopNav />
      <UpgradeToDiamondInner />
    </div>
  );
}
