"use client";

import { useState, useEffect } from "react";

type Flag = {
  id: string;
  modId: string;
  authorId: string;
  reason: string;
  createdAt: string;
  mod: { walletAddress: string | null };
  author: { walletAddress: string | null };
};

function trunc(s: string | null, n = 8) {
  if (!s) return "—";
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}...${s.slice(-n)}`;
}

export default function HonestModeratorsPanel() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/honest-moderators/scan");
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "FETCH_FAILED");
        return;
      }
      setFlags(json.flags || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "FETCH_ERROR");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const runScan = async () => {
    setScanning(true);
    setLastScanResult(null);
    try {
      const res = await fetch("/api/admin/honest-moderators/scan", { method: "POST" });
      const json = await res.json();
      if (!json.ok) {
        setLastScanResult(`Error: ${json.error}`);
        return;
      }
      setLastScanResult(`Scan complete. ${json.created} new flag(s) created.`);
      await fetchFlags();
    } catch (e) {
      setLastScanResult(`Error: ${e instanceof Error ? e.message : "SCAN_ERROR"}`);
    } finally {
      setScanning(false);
    }
  };

  const resolveFlag = async (flagId: string) => {
    if (!confirm("Mark this flag as resolved? This confirms you've reviewed the moderator's behavior.")) return;

    try {
      const res = await fetch("/api/admin/honest-moderators/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flagId }),
      });
      const json = await res.json();
      if (!json.ok) {
        alert(json.error || "RESOLVE_FAILED");
        return;
      }
      setFlags((prev) => prev.filter((f) => f.id !== flagId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "RESOLVE_ERROR");
    }
  };

  return (
    <div id="honest-moderators" className="neon-border rounded-2xl p-6 bg-black/30 border-rose-400/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center">
            <span className="text-xl">🔍</span>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-rose-400">Honest Moderators</h3>
            <p className="text-sm text-white/60">
              Flags mods who like 100% of a specific author&apos;s comments
            </p>
          </div>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="px-4 py-2 rounded-lg border border-rose-400/50 bg-rose-500/20 text-rose-300 font-semibold hover:bg-rose-500/30 transition disabled:opacity-50"
        >
          {scanning ? "Scanning..." : "Run Scan"}
        </button>
      </div>

      {lastScanResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          lastScanResult.startsWith("Error")
            ? "bg-red-500/10 border border-red-500/30 text-red-400"
            : "bg-green-500/10 border border-green-500/30 text-green-400"
        }`}>
          {lastScanResult}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-white/60 text-center py-8">Loading flags...</div>
      ) : flags.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-green-400 text-lg font-semibold mb-1">All Clear</div>
          <div className="text-white/60 text-sm">No unresolved integrity flags</div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-white/60 mb-2">
            {flags.length} unresolved flag{flags.length !== 1 ? "s" : ""}
          </div>
          {flags.map((flag) => (
            <div
              key={flag.id}
              className="p-4 rounded-xl bg-black/40 border border-rose-500/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      FLAGGED
                    </span>
                    <span className="text-xs text-white/40">
                      {new Date(flag.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-white/50">Moderator:</span>{" "}
                      <span className="text-white font-mono">{trunc(flag.mod?.walletAddress)}</span>
                    </div>
                    <div>
                      <span className="text-white/50">Author:</span>{" "}
                      <span className="text-white font-mono">{trunc(flag.author?.walletAddress)}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-white/70">{flag.reason}</div>
                </div>
                <button
                  onClick={() => resolveFlag(flag.id)}
                  className="px-3 py-1.5 rounded-lg border border-green-500/50 bg-green-500/20 text-green-400 text-xs font-semibold hover:bg-green-500/30 transition whitespace-nowrap"
                >
                  Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/10 text-xs text-white/40">
        <strong>How it works:</strong> The scan checks all mod votes. If a moderator has liked 100% of
        a specific Diamond author&apos;s comments (minimum 10 votes), they get flagged for review.
        Resolving a flag confirms you&apos;ve reviewed and addressed the issue.
      </div>
    </div>
  );
}
