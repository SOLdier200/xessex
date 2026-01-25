"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export default function LogoutModal({
  open,
  onClose,
  onLogoutComplete,
  email,
  walletAddress,
  tier,
}: {
  open: boolean;
  onClose: () => void;
  onLogoutComplete: () => void;
  email?: string | null;
  walletAddress?: string | null;
  tier?: "member" | "diamond" | "free" | null;
}) {
  const [loading, setLoading] = useState(false);
  const { disconnect, connected } = useWallet();

  const isDiamond = tier === "diamond";

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // Clear server session
      await fetch("/api/auth/logout", { method: "POST" });

      // Disconnect wallet if connected
      if (connected) {
        try {
          await disconnect();
        } catch (err) {
          console.error("Wallet disconnect failed:", err);
        }
      }

      // Dispatch auth-changed event so all components can react
      window.dispatchEvent(new CustomEvent("auth-changed"));

      onLogoutComplete();
      onClose();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  // Determine what to display based on tier
  // Diamond: Show wallet address (primary)
  // Member: Show email (primary)
  const isMember = tier === "member";

  let displayValue: string | null = null;
  if (isDiamond && walletAddress) {
    displayValue = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  } else if (isMember && email) {
    displayValue = email;
  } else if (email) {
    displayValue = email;
  } else if (walletAddress) {
    displayValue = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }

  const tierLabel = isDiamond ? "Diamond Member" : isMember ? "Member" : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl neon-border bg-black/90 p-6">
        {/* Show logged in user info */}
        {displayValue && (
          <div className="mb-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50 uppercase tracking-wide">Logged in as</span>
              {tierLabel && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  isDiamond
                    ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/30"
                    : "bg-pink-500/20 text-pink-300 border border-pink-400/30"
                }`}>
                  {tierLabel}
                </span>
              )}
            </div>
            <div className="text-sm text-white font-medium mt-1 truncate font-mono">
              {displayValue}
            </div>
            {/* Show email for diamond members who also have email */}
            {isDiamond && email && walletAddress && (
              <div className="text-xs text-white/50 mt-1 truncate">
                {email}
              </div>
            )}
          </div>
        )}

        <h2 className="text-lg font-semibold text-white mb-2">Log Out</h2>
        <p className="text-sm text-white/60 mb-6">
          Are you sure you want to log out? You will be treated as a free user
          until you log back in.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleLogout}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-pink-500/20 to-red-500/20 hover:from-pink-500/30 hover:to-red-500/30 border border-pink-400/40 text-pink-100 text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}
