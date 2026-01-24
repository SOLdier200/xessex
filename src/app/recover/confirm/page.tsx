"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import Link from "next/link";

function RecoverConfirmContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token") || "";

  const { wallet, publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const [status, setStatus] = useState<
    "idle" | "working" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string>("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasSigner = !!(wallet?.adapter as any)?.signMessage;
  const newWallet = publicKey?.toBase58() || "";

  const canRestore = useMemo(() => {
    return (
      !!token &&
      connected &&
      !!publicKey &&
      hasSigner &&
      status !== "working"
    );
  }, [token, connected, publicKey, hasSigner, status]);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Missing recovery token.");
    }
  }, [token]);

  async function doRestore() {
    try {
      setStatus("working");
      setError("");

      if (!token) throw new Error("Missing recovery token.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter = wallet?.adapter as any;
      if (!adapter?.signMessage)
        throw new Error("Wallet does not support message signing.");
      if (!publicKey) throw new Error("Connect a wallet first.");

      // 1) Get challenge (server builds message)
      const ch = await fetch("/api/diamond/recover/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newWallet }),
      }).then((r) => r.json());

      if (!ch?.ok) throw new Error(ch?.error || "Failed to start recovery.");

      // 2) Sign message
      const msgBytes = new TextEncoder().encode(ch.message);
      const sigBytes = await adapter.signMessage(msgBytes);
      const signature = bs58.encode(sigBytes);

      // 3) Restore
      const resp = await fetch("/api/diamond/recover/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          wallet: newWallet,
          signature,
          nonce: ch.nonce,
        }),
      }).then((r) => r.json());

      if (!resp?.ok) throw new Error(resp?.error || "Restore failed.");

      setStatus("success");

      // Redirect to diamond login after success
      setTimeout(() => router.push("/login/diamond"), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus("error");
      setError(msg);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold">Recover Diamond Membership</h1>
        <p className="mt-2 text-white/70">
          Connect your new wallet, then restore your Diamond membership to it.
        </p>

        {!token && status === "error" && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
            Missing recovery token. Please use the link from your email.
          </div>
        )}

        {token && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/70">New wallet</div>
            <div className="mt-1 min-h-[24px] break-all font-mono text-sm">
              {newWallet || "Not connected"}
            </div>

            {!connected ? (
              <button
                onClick={() => setVisible(true)}
                className="mt-4 w-full rounded-xl bg-[#ff4fd8] px-4 py-3 font-bold text-black transition-opacity hover:opacity-90"
              >
                Connect Wallet
              </button>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <button
                  disabled={!canRestore}
                  onClick={doRestore}
                  className="w-full rounded-xl bg-[#ff4fd8] px-4 py-3 font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {status === "working"
                    ? "Restoring..."
                    : "Restore Membership to New Wallet"}
                </button>
                <button
                  onClick={() => disconnect()}
                  className="w-full rounded-xl border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5"
                >
                  Disconnect Wallet
                </button>
              </div>
            )}

            {status === "error" && error && (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
                {error}
              </div>
            )}

            {status === "success" && (
              <div className="mt-4 rounded-xl border border-green-500/40 bg-green-500/10 p-3">
                <div className="flex items-center gap-2 text-green-400">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="font-semibold">Membership restored!</span>
                </div>
                <p className="mt-1 text-sm text-white/70">
                  Your Diamond membership has been moved to your new wallet.
                  Redirecting to login...
                </p>
              </div>
            )}

            {connected && !hasSigner && (
              <div className="mt-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
                This wallet doesn&apos;t support message signing. Try Phantom or
                another wallet that supports signMessage.
              </div>
            )}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/login/diamond"
            className="text-sm text-white/50 hover:text-white/70"
          >
            Back to Diamond Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RecoverConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-white">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#ff4fd8] border-t-transparent" />
        </div>
      }
    >
      <RecoverConfirmContent />
    </Suspense>
  );
}
