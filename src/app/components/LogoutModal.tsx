"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";

export default function LogoutModal({
  open,
  onClose,
  onLogoutComplete,
  email,
  walletAddress,
  creditBalance,
  username,
  avatarUrl,
}: {
  open: boolean;
  onClose: () => void;
  onLogoutComplete: () => void;
  email?: string | null;
  walletAddress?: string | null;
  tier?: "member" | "diamond" | "free" | null;
  creditBalance?: number;
  username?: string | null;
  avatarUrl?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const { disconnect, connected } = useWallet();

  // Reset img error state when avatarUrl changes
  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

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

  const handleCopyWallet = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      toast.success("Copied to clipboard!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl neon-border bg-black/90 p-6">
        {/* Show logged in user info */}
        {walletAddress && (
          <div className="mb-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3 mb-3">
              {/* Avatar */}
              {avatarUrl && !imgFailed ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover border-2 border-pink-500/50"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500/30 to-purple-500/30 flex items-center justify-center text-white/60 text-xl font-semibold border-2 border-white/20">
                  {username ? username.charAt(0).toUpperCase() : walletAddress.slice(0, 2)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/50 uppercase tracking-wide mb-1">Logged in as</div>
                {/* Show username if available */}
                {username && (
                  <div className="text-lg font-semibold text-pink-400 truncate">
                    {username}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleCopyWallet}
              className="w-full text-left text-sm text-cyan-400 hover:text-cyan-300 font-mono break-all transition cursor-pointer hover:bg-white/5 rounded-lg p-2 -m-2"
              title="Click to copy"
            >
              {walletAddress}
            </button>
            {/* Show email if also has email */}
            {email && (
              <div className="text-xs text-white/50 mt-2 truncate">
                {email}
              </div>
            )}
            {/* Show credit balance */}
            {creditBalance !== undefined && (
              <div className="mt-3 flex items-center justify-between bg-yellow-500/10 rounded-lg p-3">
                <span className="text-xs text-white/70">Special Credits</span>
                <span className="text-lg font-bold text-yellow-400">{creditBalance}</span>
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
