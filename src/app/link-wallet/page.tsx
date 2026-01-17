"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import TopNav from "../components/TopNav";
import SolanaProviders from "@/components/SolanaProviders";

type MeResponse =
  | { ok: true; user: { id: string; role: string; solWallet?: string | null; walletAddress?: string | null } | null }
  | { ok: false; error?: string };

function detectPlatform() {
  if (typeof navigator === "undefined") return { isAndroid: false, isIos: false, isChromeAndroid: false };
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = ua.includes("android");
  const isIos =
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    (ua.includes("mac") && (navigator as any).maxTouchPoints > 1);
  const isChromeAndroid = isAndroid && ua.includes("chrome/");
  return { isAndroid, isIos, isChromeAndroid };
}

function short(addr?: string | null) {
  if (!addr) return "";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function LinkWalletContent() {
  const router = useRouter();
  const { publicKey, signMessage, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const p = useMemo(detectPlatform, []);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [status, setStatus] = useState<"idle" | "signing" | "verifying" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const linkedWallet =
    me && me.ok && me.user ? (me.user.solWallet || me.user.walletAddress || null) : null;

  // Load session
  useEffect(() => {
    let alive = true;
    setLoadingMe(true);
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: MeResponse) => {
        if (!alive) return;
        setMe(d);
        setLoadingMe(false);

        // Must be logged in to link
        if (!d.ok || !d.user) {
          router.push("/login?next=/link-wallet");
        }
      })
      .catch(() => {
        if (!alive) return;
        setLoadingMe(false);
        router.push("/login?next=/link-wallet");
      });

    return () => {
      alive = false;
    };
  }, [router]);

  // If coming from 409 flow, pre-store wallet to link (optional UX)
  useEffect(() => {
    try {
      const pending = localStorage.getItem("pending_wallet_to_link");
      // we don't force connect to this wallet (wallet adapter chooses),
      // but we can show the hint to the user.
      if (pending) {
        // keep it for display; no hard requirement
      }
    } catch {}
  }, []);

  const openInPhantom = () => {
    if (typeof window === "undefined") return;
    const url = encodeURIComponent(window.location.href);
    const ref = encodeURIComponent(window.location.origin);
    window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
  };

  const handleLinkWallet = async () => {
    if (!publicKey || !signMessage) {
      setError("Please connect a wallet that supports message signing.");
      return;
    }

    setStatus("signing");
    setError(null);

    try {
      // 1) challenge
      const challengeRes = await fetch("/api/auth/wallet-link/challenge", { method: "POST" });
      const challengeData = await challengeRes.json();

      if (!challengeData.ok) throw new Error(challengeData.error || "Failed to get challenge");

      const { message, nonce } = challengeData;

      // 2) sign
      const msgBytes = new TextEncoder().encode(message);
      const signature = await signMessage(msgBytes);
      const signatureB58 = bs58.encode(signature);

      setStatus("verifying");

      // 3) verify
      const verifyRes = await fetch("/api/auth/wallet-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          signature: signatureB58,
          nonce,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.ok) throw new Error(verifyData.error || "Failed to verify signature");

      setStatus("success");

      // refresh me so we can display linked wallet immediately
      const fresh = await fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json());
      setMe(fresh);

      // cleanup
      try {
        localStorage.removeItem("pending_wallet_to_link");
      } catch {}

      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1200);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      <div className="neon-border rounded-2xl bg-black/80 p-6 md:p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Wallet</h1>

        {p.isIos && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
            iOS tip: wallet connection works best from inside Phantom/Solflare's in-app browser.
          </div>
        )}
        {p.isAndroid && !p.isChromeAndroid && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
            Android tip: wallet connect works best in Chrome. If it fails here, open this page in Chrome.
          </div>
        )}

        {loadingMe ? (
          <p className="text-white/60">Loading...</p>
        ) : (
          <>
            {/* Show current linked state */}
            {linkedWallet ? (
              <div className="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                <div className="text-emerald-200 font-semibold">Wallet linked</div>
                <div className="mt-1 text-sm text-white/70">
                  Current: <span className="font-mono text-white">{linkedWallet}</span>
                  <span className="ml-2 text-white/50">({short(linkedWallet)})</span>
                </div>
                <div className="mt-3 text-xs text-white/50">
                  If you need to change wallets later, we can add a "Replace wallet" flow that requires re-auth.
                </div>
              </div>
            ) : (
              <p className="text-white/60 mb-6">
                Connect and sign with your Solana wallet to link it to your account. This enables on-chain features and payments.
              </p>
            )}

            <div className="space-y-4">
              {/* Connect */}
              <div className="flex flex-col items-center gap-3">
                {!connected ? (
                  <>
                    <button
                      onClick={() => setVisible(true)}
                      className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/40 text-white font-medium hover:from-purple-500/30 hover:to-pink-500/30 transition"
                    >
                      Select Wallet
                    </button>

                    {p.isIos && (
                      <button
                        onClick={openInPhantom}
                        className="w-full py-3 px-6 rounded-xl border border-white/20 bg-white/10 text-white/90 font-medium hover:bg-white/15 transition"
                      >
                        Open in Phantom (iOS)
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-white/60">
                    Connected: {short(publicKey?.toBase58())}
                  </div>
                )}
              </div>

              {/* Link */}
              {connected && publicKey && (
                <button
                  onClick={handleLinkWallet}
                  disabled={status === "signing" || status === "verifying" || status === "success"}
                  className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 hover:from-yellow-500/30 hover:to-orange-500/30 border border-yellow-400/40 text-yellow-100 font-medium transition disabled:opacity-50"
                >
                  {status === "idle" && (linkedWallet ? "Sign & Confirm Wallet" : "Sign & Link Wallet")}
                  {status === "signing" && "Signing message..."}
                  {status === "verifying" && "Verifying..."}
                  {status === "success" && "Wallet Linked!"}
                  {status === "error" && "Try Again"}
                </button>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-400/30 text-red-300 text-sm">
                  {error}
                </div>
              )}

              {status === "success" && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-sm">
                  Wallet linked! Redirecting...
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10">
              <p className="text-xs text-white/40">
                You can link one wallet per account. Linking proves you control the address by signing a message.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function LinkWalletPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black">
      <TopNav />
      <SolanaProviders>
        <LinkWalletContent />
      </SolanaProviders>
    </div>
  );
}
