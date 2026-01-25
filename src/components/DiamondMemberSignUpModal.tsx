"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import Image from "next/image";
import bs58 from "bs58";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    (ua.includes("mac") && (navigator as any).maxTouchPoints > 1)
  );
}

export default function DiamondMemberSignUpModal({ open, onClose, onCreated }: Props) {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile platform
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = ua.includes("android");
    const ios = isIOS();
    setIsMobile(isAndroid || ios);
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStatus("");
      setSuccess(false);
    }
  }, [open]);

  const openInPhantom = () => {
    if (typeof window === "undefined") return;
    const url = encodeURIComponent(window.location.href);
    const ref = encodeURIComponent(window.location.origin);
    window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
  };

  if (!open) return null;

  async function startDiamond() {
    if (!wallet.publicKey) {
      setStatus("Please connect your wallet first");
      return;
    }

    if (!wallet.signMessage) {
      setStatus("Wallet does not support message signing");
      return;
    }

    setBusy(true);
    setStatus("Requesting challenge...");

    try {
      const walletAddr = wallet.publicKey.toBase58();

      // 1) Get challenge message (server sets httpOnly challenge cookie)
      const ch = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ wallet: walletAddr, purpose: "DIAMOND_SIGNUP" }),
      }).then(r => r.json());

      if (!ch?.ok) {
        throw new Error(ch?.error || "Challenge failed");
      }

      setStatus("Please sign the message in your wallet...");

      // 2) Sign message
      const msgBytes = new TextEncoder().encode(ch.message);
      const sigBytes = await wallet.signMessage(msgBytes);

      setStatus("Verifying signature...");

      // 3) Verify signature (creates session cookie)
      const verify = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          wallet: walletAddr,
          message: ch.message,
          signature: bs58.encode(sigBytes),
        }),
      }).then(r => r.json());

      if (!verify?.ok) {
        throw new Error(verify?.error || "Verification failed");
      }

      setStatus("Creating Diamond account...");

      // 4) Mark subscription as pending diamond
      const start = await fetch("/api/auth/diamond/start", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      }).then(r => r.json());

      if (!start?.ok) {
        throw new Error(start?.error || "Could not create Diamond account");
      }

      setSuccess(true);
      setStatus("Diamond account created! Proceeding to payment options...");
      window.dispatchEvent(new Event("auth-changed"));

      setTimeout(() => {
        onCreated?.();
      }, 1200);
    } catch (e: any) {
      setStatus(e?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-zinc-900 to-black border border-cyan-500/30 p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex justify-center mb-4">
          <Image
            src="/logos/textlogo/siteset3/diamond100.png"
            alt="Diamond Member"
            width={1536}
            height={282}
            className="h-[45px] w-auto"
          />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2 text-center">Diamond Member Sign Up</h2>
        <p className="text-sm text-white/60 mb-6 text-center">
          Connect your Solana wallet to create your Diamond account
        </p>

        <div className="space-y-4">
          {/* Wallet Connection Status */}
          <div className={`p-4 rounded-xl border ${
            wallet.connected
              ? "border-green-500/50 bg-green-500/10"
              : "border-purple-400/30 bg-purple-500/10"
          }`}>
            <div className="flex items-center gap-3">
              {wallet.connected ? (
                <>
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <div>
                    <p className="text-green-400 font-medium">Wallet Connected</p>
                    <p className="text-white/60 text-sm font-mono">
                      {wallet.publicKey?.toBase58().slice(0, 4)}...{wallet.publicKey?.toBase58().slice(-4)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full bg-purple-400" />
                  <p className="text-white/70">No wallet connected</p>
                </>
              )}
            </div>
          </div>

          {/* Connect Wallet Button */}
          {!wallet.connected && (
            <>
              <button
                onClick={() => setVisible(true)}
                disabled={busy}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold hover:from-purple-500 hover:to-violet-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="M2 10h20"/>
                </svg>
                Connect Wallet
              </button>

              {isMobile && (
                <button
                  onClick={openInPhantom}
                  disabled={busy}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-white/90 transition border border-white/20 bg-white/10 hover:bg-white/15 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Open in Phantom
                </button>
              )}
            </>
          )}

          {/* Create Account Button */}
          {wallet.connected && !success && (
            <button
              onClick={startDiamond}
              disabled={busy}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold hover:from-cyan-500 hover:to-blue-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {status || "Working..."}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <line x1="20" y1="8" x2="20" y2="14"/>
                    <line x1="23" y1="11" x2="17" y2="11"/>
                  </svg>
                  Create Diamond Account
                </>
              )}
            </button>
          )}

          {/* Success State */}
          {success && (
            <div className="p-4 rounded-xl bg-green-500/20 border border-green-500/50 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-green-400">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <p className="text-green-400 font-medium">Account Created!</p>
            </div>
          )}

          {/* Status Message (when not busy and not success) */}
          {status && !busy && !success && (
            <div className="text-sm text-center text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              {status}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 rounded-xl bg-cyan-500/10 border border-cyan-400/30">
          <h3 className="text-cyan-400 font-medium text-sm mb-2">Diamond Benefits</h3>
          <ul className="text-white/60 text-xs space-y-1">
            <li>• Earn XESS tokens for viewing and rating videos</li>
            <li>• Post comments and interact with community</li>
            <li>• Access exclusive Diamond-only content</li>
            <li>• Participate in weekly rewards draws</li>
          </ul>
        </div>

        {/* Disconnect Option */}
        {wallet.connected && !busy && (
          <button
            onClick={() => wallet.disconnect()}
            className="mt-4 w-full py-2 text-sm text-white/50 hover:text-white/70 transition"
          >
            Disconnect Wallet
          </button>
        )}
      </div>
    </div>
  );
}
