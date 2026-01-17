"use client";

import { useState } from "react";

export default function RecomputeRanksCard() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/admin/recompute-ranks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(`Error: ${data?.error || `Request failed (${res.status})`}`);
        return;
      }

      setMsg(`Success: rebuilt ranks for ${data?.total ?? "all"} videos`);
    } catch {
      setMsg("Error: network request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="neon-border rounded-2xl p-6 bg-black/30">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center">
          <span className="text-2xl">🏆</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Recompute Video Ranks</h2>
          <p className="text-sm text-white/60">Rebuild global rank ordering</p>
        </div>
      </div>

      <button
        onClick={run}
        disabled={loading}
        className={`w-full px-4 py-3 rounded-xl border font-semibold transition ${
          loading
            ? "border-white/20 bg-white/5 text-white/40 cursor-not-allowed"
            : "border-amber-400/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
        }`}
      >
        {loading ? "Recomputing..." : "Recompute Now"}
      </button>

      {msg && <div className="mt-3 text-sm text-white/80">{msg}</div>}
    </div>
  );
}
