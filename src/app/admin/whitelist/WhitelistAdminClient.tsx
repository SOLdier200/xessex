"use client";

import { useState, useEffect, useCallback } from "react";

type WhitelistEntry = {
  id: string;
  wallet: string;
  note: string | null;
  addedBy: string | null;
  addedAt: string;
};

function shortenWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

export default function WhitelistAdminClient({
  isAdmin,
}: {
  isAdmin: boolean;
}) {
  const [wallets, setWallets] = useState<WhitelistEntry[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [newWallets, setNewWallets] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<string | null>(null);

  // Rebuild
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<string | null>(null);

  // Search
  const [search, setSearch] = useState("");

  // Removing
  const [removingWallet, setRemovingWallet] = useState<string | null>(null);

  const fetchWallets = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/whitelist");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to load");
      setWallets(json.wallets);
      setCount(json.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const handleAdd = async () => {
    if (!isAdmin || !newWallets.trim()) return;
    setAdding(true);
    setAddResult(null);
    try {
      // Split by newlines, commas, or spaces
      const parsed = newWallets
        .split(/[\n,\s]+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 32);

      if (parsed.length === 0) {
        setAddResult("No valid wallet addresses found");
        return;
      }

      const res = await fetch("/api/admin/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallets: parsed, note: note || null }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to add");
      setAddResult(`Added ${json.added}, skipped ${json.skipped} duplicates`);
      setNewWallets("");
      setNote("");
      await fetchWallets();
    } catch (err) {
      setAddResult(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (wallet: string) => {
    if (!isAdmin) return;
    setRemovingWallet(wallet);
    try {
      const res = await fetch(
        `/api/admin/whitelist?wallet=${encodeURIComponent(wallet)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to remove");
      await fetchWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setRemovingWallet(null);
    }
  };

  const handleRebuild = async () => {
    if (!isAdmin) return;
    setRebuilding(true);
    setRebuildResult(null);
    try {
      const res = await fetch("/api/admin/whitelist/rebuild", {
        method: "POST",
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to rebuild");
      setRebuildResult(
        json.walletCount > 0
          ? `Merkle tree rebuilt with ${json.walletCount} wallets. Root: ${json.rootHex.slice(0, 16)}...`
          : "Merkle tree cleared (no wallets)"
      );
    } catch (err) {
      setRebuildResult(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setRebuilding(false);
    }
  };

  const filtered = search
    ? wallets.filter(
        (w) =>
          w.wallet.includes(search.toLowerCase()) ||
          w.note?.toLowerCase().includes(search.toLowerCase())
      )
    : wallets;

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-8">
        <div className="text-white/50 text-center">
          Loading whitelist data...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">
            Wallet Whitelist Management
          </h1>
          <a
            href="/admin/presale"
            className="text-sm text-white/50 hover:text-white transition"
          >
            &larr; Back to Presale
          </a>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-400 hover:text-red-200"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/50 text-sm">Whitelisted Wallets</div>
            <div className="text-2xl font-bold text-emerald-400">{count}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/50 text-sm">Status</div>
            <div className="text-2xl font-bold text-yellow-400">
              {count > 0 ? "Active" : "Empty"}
            </div>
          </div>
          {isAdmin && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col justify-between">
              <div className="text-white/50 text-sm mb-2">Merkle Tree</div>
              <button
                onClick={handleRebuild}
                disabled={rebuilding}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 transition text-sm"
              >
                {rebuilding ? "Rebuilding..." : "Rebuild Merkle Tree"}
              </button>
              {rebuildResult && (
                <div
                  className={`text-xs mt-2 ${rebuildResult.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}
                >
                  {rebuildResult}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add Wallets (Admin Only) */}
        {isAdmin && (
          <div className="rounded-xl border border-pink-500/30 bg-pink-500/5 p-6">
            <h2 className="text-xl font-semibold text-pink-300 mb-4">
              Add Wallets
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Wallet Addresses (one per line, or comma/space separated)
                </label>
                <textarea
                  value={newWallets}
                  onChange={(e) => setNewWallets(e.target.value)}
                  placeholder="9xYourWalletAddress1Here&#10;4PYourWalletAddress2Here"
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-black border border-white/20 text-white font-mono text-sm placeholder:text-white/20 resize-y"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., Early supporters batch"
                  className="w-full px-3 py-2 rounded-lg bg-black border border-white/20 text-white text-sm placeholder:text-white/20"
                />
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleAdd}
                  disabled={adding || !newWallets.trim()}
                  className="px-4 py-2 rounded-lg bg-pink-500 text-white font-medium hover:bg-pink-600 disabled:opacity-50 transition"
                >
                  {adding ? "Adding..." : "Add Wallets"}
                </button>
                {addResult && (
                  <span
                    className={`text-sm ${addResult.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}
                  >
                    {addResult}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Wallet List */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">
              Approved Wallets ({filtered.length})
            </h2>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search wallets..."
              className="px-3 py-1.5 rounded-lg bg-black border border-white/20 text-white text-sm placeholder:text-white/30 w-64"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/50 border-b border-white/10">
                  <th className="text-left py-2 px-2">Wallet</th>
                  <th className="text-left py-2 px-2">Note</th>
                  <th className="text-left py-2 px-2">Added By</th>
                  <th className="text-left py-2 px-2">Added At</th>
                  {isAdmin && (
                    <th className="text-right py-2 px-2">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="py-2 px-2 font-mono text-white/80">
                      <span className="hidden md:inline">{entry.wallet}</span>
                      <span className="md:hidden">
                        {shortenWallet(entry.wallet)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-white/60">
                      {entry.note || "-"}
                    </td>
                    <td className="py-2 px-2 text-white/60 font-mono text-xs">
                      {entry.addedBy
                        ? shortenWallet(entry.addedBy)
                        : "-"}
                    </td>
                    <td className="py-2 px-2 text-white/60">
                      {new Date(entry.addedAt).toLocaleDateString()}
                    </td>
                    {isAdmin && (
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => handleRemove(entry.wallet)}
                          disabled={removingWallet === entry.wallet}
                          className="px-3 py-1 rounded text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-50 transition"
                        >
                          {removingWallet === entry.wallet
                            ? "Removing..."
                            : "Remove"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={isAdmin ? 5 : 4}
                      className="py-8 text-center text-white/40"
                    >
                      {search
                        ? "No wallets match your search"
                        : "No wallets whitelisted yet"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
