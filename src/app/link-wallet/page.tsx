"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import TopNav from "../components/TopNav";

export default function LinkWalletPage() {
  const router = useRouter();
  const { publicKey, signMessage, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const [status, setStatus] = useState<"idle" | "signing" | "verifying" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Check if user is logged in and needs wallet link
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok || !d.authed) {
          router.push("/login");
          return;
        }
        if (d.membership !== "DIAMOND") {
          router.push("/");
          return;
        }
        if (!d.needsSolWalletLink) {
          // Already has wallet linked
          router.push("/");
          return;
        }
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const handleLinkWallet = async () => {
    if (!publicKey || !signMessage) {
      setError("Please connect your wallet first");
      return;
    }

    setStatus("signing");
    setError(null);

    try {
      // 1. Get challenge from server
      const challengeRes = await fetch("/api/auth/wallet-link/challenge", {
        method: "POST",
      });
      const challengeData = await challengeRes.json();

      if (!challengeData.ok) {
        throw new Error(challengeData.error || "Failed to get challenge");
      }

      const { message, nonce } = challengeData;

      // 2. Sign the message
      const msgBytes = new TextEncoder().encode(message);
      const signature = await signMessage(msgBytes);
      const signatureB58 = bs58.encode(signature);

      setStatus("verifying");

      // 3. Verify with server
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

      if (!verifyData.ok) {
        throw new Error(verifyData.error || "Failed to verify signature");
      }

      setStatus("success");

      // Redirect after short delay
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1500);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black">
      <TopNav />

      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="neon-border rounded-2xl bg-black/80 p-6 md:p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Link Your Wallet</h1>
          <p className="text-white/60 mb-6">
            Connect and sign with your Solana wallet to link it to your Diamond account.
            This enables you to receive Xess payments and interact with on-chain features.
          </p>

          <div className="space-y-4">
            {/* Wallet Connect Button */}
            <div className="flex flex-col items-center gap-4">
              {!connected ? (
                <button
                  onClick={() => setVisible(true)}
                  className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/40 text-white font-medium hover:from-purple-500/30 hover:to-pink-500/30 transition"
                >
                  Select Wallet
                </button>
              ) : (
                <div className="text-sm text-white/60">
                  Connected: {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                </div>
              )}
            </div>

            {/* Link Button */}
            {connected && publicKey && (
              <button
                onClick={handleLinkWallet}
                disabled={status === "signing" || status === "verifying" || status === "success"}
                className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 hover:from-yellow-500/30 hover:to-orange-500/30 border border-yellow-400/40 text-yellow-100 font-medium transition disabled:opacity-50"
              >
                {status === "idle" && "Sign & Link Wallet"}
                {status === "signing" && "Signing message..."}
                {status === "verifying" && "Verifying..."}
                {status === "success" && "Wallet Linked!"}
                {status === "error" && "Try Again"}
              </button>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-400/30 text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {status === "success" && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-sm">
                Your wallet has been linked! Redirecting...
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-white/40">
              By linking your wallet, you agree to use it for receiving payments and
              interacting with Xessex features. You can only link one wallet per account.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
