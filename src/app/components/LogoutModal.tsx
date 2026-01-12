"use client";

import { useState } from "react";

export default function LogoutModal({
  open,
  onClose,
  onLogoutComplete,
}: {
  open: boolean;
  onClose: () => void;
  onLogoutComplete: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // Clear server session
      await fetch("/api/auth/logout", { method: "POST" });

      onLogoutComplete();
      onClose();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl neon-border bg-black/90 p-6">
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
