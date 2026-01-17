"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FreeUserModal({
  open,
  onClose,
  onLogoutComplete,
  isWalletOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  onLogoutComplete: () => void;
  isWalletOnly?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });

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

  const handleLogin = () => {
    onClose();
    router.push("/login");
  };

  const handlePurchase = () => {
    onClose();
    router.push("/signup");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl neon-border bg-black/90 p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Account Options</h2>
        <p className="text-sm text-white/60 mb-6">
          {isWalletOnly
            ? "Your wallet is connected. Login with email or purchase a membership to unlock full access."
            : "Your account is created. Purchase a membership to unlock full access."}
        </p>

        <div className="flex flex-col gap-3">
          {isWalletOnly && (
            <button
              onClick={handleLogin}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-sky-500/20 to-blue-500/20 hover:from-sky-500/30 hover:to-blue-500/30 border border-sky-400/40 text-sky-100 text-sm font-medium transition"
            >
              Login
            </button>
          )}
          <button
            onClick={handlePurchase}
            className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-400/40 text-amber-100 text-sm font-medium transition"
          >
            Purchase Membership
          </button>
          <button
            onClick={handleLogout}
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}
