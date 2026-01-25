"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import Image from "next/image";
import bs58 from "bs58";
import {
  diamondUpgradeChallenge,
  diamondUpgradeVerify,
  isIOS,
} from "@/lib/walletFlows";

type Props = {
  open: boolean;
  onClose: () => void;
  onUpgraded?: () => void;
};

/**
 * DiamondUpgradeModal - For existing MEMBERS upgrading to Diamond
 *
 * Use this when a user already has a Member account and wants to upgrade
 * to Diamond while preserving their existing account data (comments, likes, rewards).
 *
 * For new users creating a wallet-native Diamond account, use DiamondSignupModal instead.
 */
export default function DiamondUpgradeModal({ open, onClose, onUpgraded }: Props) {
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
    const url = new URL(window.location.href);
    url.searchParams.set("diamondUpgrade", "1");
    const ref = encodeURIComponent(window.location.origin);
    window.location.href = `https://phantom.app/ul/browse/${encodeURIComponent(url.toString())}?ref=${ref}`;
  };

  if (!open) return null;

  async function handleUpgrade() {
    if (!wallet.publicKey) {
      setStatus("Please connect your wallet first");
      return;
    }

    if (!wallet.signMessage) {
      setStatus("Wallet does not support message signing");
      return;
    }

    setBusy(true);
    setStatus("Requesting upgrade challenge...");

    try {
      // 1) Get upgrade challenge (requires existing Member session)
      const ch = await diamondUpgradeChallenge();

      if (!ch?.ok) {
        throw new Error((ch as any)?.error || "Failed to get upgrade challenge");
      }

      const { message, nonce } = ch as { ok: true; message: string; nonce: string; expiresAt: string };

      setStatus("Please sign the message in your wallet...");

      // 2) Sign message
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = await wallet.signMessage(msgBytes);
      const signature = bs58.encode(sigBytes);

      setStatus("Upgrading to Diamond...");

      // 3) Complete upgrade
      const result = await diamondUpgradeVerify(
        wallet.publicKey.toBase58(),
        signature,
        nonce
      );

      if (!result.ok) {
        const err = (result as any).error;
        if (err === "WALLET_ALREADY_LINKED") {
          throw new Error("This wallet is already linked to another account");
        }
        throw new Error(err || "Upgrade failed");
      }

      setSuccess(true);
      setStatus("Upgraded to Diamond! Proceeding to payment...");
      window.dispatchEvent(new Event("auth-changed"));

      setTimeout(() => {
        onUpgraded?.();
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
        <h2 className="text-xl font-semibold text-white mb-2 text-center">Upgrade to Diamond</h2>
        <p className="text-sm text-white/60 mb-6 text-center">
          Connect your Solana wallet to upgrade your account to Diamond
        </p>
        {isMobile && (
          <p className="text-xs text-purple-400 animate-pulse text-center -mt-4 mb-4">
            Note: All mobile users will need to download Phantom and select Open in Phantom to connect.
          </p>
        )}

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

          {/* Upgrade Button */}
          {wallet.connected && !success && (
            <button
              onClick={handleUpgrade}
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
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                  Upgrade to Diamond
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
              <p className="text-green-400 font-medium">Upgraded to Diamond!</p>
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
          <h3 className="text-cyan-400 font-medium text-sm mb-2">What happens when you upgrade?</h3>
          <ul className="text-white/60 text-xs space-y-1">
            <li>• Your wallet becomes your login identity</li>
            <li>• All your comments, likes, and rewards are preserved</li>
            <li>• You&apos;ll proceed to complete Diamond payment</li>
            <li>• Email login still works as backup</li>
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
