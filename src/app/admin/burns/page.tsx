"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";

type BurnRecord = {
  id: string;
  weekKey: string | null;
  pool: string;
  reason: string;
  amount: string;
  description: string | null;
  txSig: string | null;
  createdAt: string;
};

type BurnSummary = {
  totalBurned: string;
  totalSupply: string;
  burnPercentage: string;
  byPool: {
    XESSEX: string;
    EMBED: string;
  };
  byReason: Record<string, string>;
  burnCount: number;
  recentBurns: BurnRecord[];
};

export default function AdminBurnsPage() {
  const [data, setData] = useState<BurnSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [allBurns, setAllBurns] = useState<BurnRecord[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/burns/summary", { credentials: "include" });
      const d = await res.json();
      if (d.ok) {
        setData(d);
        setAllBurns(d.recentBurns);
      }
    } catch (e) {
      toast.error("Failed to load burn data");
    } finally {
      setLoading(false);
    }
  }

  async function loadAllBurns() {
    setLoadingAll(true);
    try {
      const res = await fetch("/api/admin/burns", { credentials: "include" });
      const d = await res.json();
      if (d.ok) {
        setAllBurns(d.burns);
      }
    } catch (e) {
      toast.error("Failed to load all burns");
    } finally {
      setLoadingAll(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Burn Tracker</h1>
          <p className="text-white/60 text-sm mt-1">
            Track and manage XESS token burns
          </p>
        </div>
        <Link
          href="/admin/controls"
          className="px-4 py-2 rounded-full border border-white/30 bg-black/40 text-white text-sm font-semibold hover:bg-white/10 transition"
        >
          &larr; Back
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-white/60">Loading...</p>
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center">
          <p className="text-white/60">Failed to load burn data</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
              <div className="text-xs text-orange-400 uppercase tracking-wide mb-1">Total Burned</div>
              <div className="text-2xl font-bold text-white">{data.totalBurned}</div>
              <div className="text-xs text-white/50">XESS</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-4">
              <div className="text-xs text-white/50 uppercase tracking-wide mb-1">% of Supply</div>
              <div className="text-2xl font-bold text-white">{data.burnPercentage}%</div>
            </div>

            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
              <div className="text-xs text-cyan-400 uppercase tracking-wide mb-1">Xessex Pool</div>
              <div className="text-2xl font-bold text-white">{data.byPool.XESSEX}</div>
              <div className="text-xs text-white/50">XESS burned</div>
            </div>

            <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
              <div className="text-xs text-orange-400 uppercase tracking-wide mb-1">Embed Pool</div>
              <div className="text-2xl font-bold text-white">{data.byPool.EMBED}</div>
              <div className="text-xs text-white/50">XESS burned</div>
            </div>
          </div>

          {/* Burns by Reason */}
          {Object.keys(data.byReason).length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4">Burns by Reason</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(data.byReason).map(([reason, amount]) => (
                  <div key={reason} className="bg-black/40 rounded-lg p-3">
                    <div className="text-xs text-white/50 capitalize mb-1">{reason.replace(/_/g, " ")}</div>
                    <div className="text-lg font-bold text-orange-400">{amount} XESS</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Burn Records Table */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Burn Records ({data.burnCount})</h2>
              {data.burnCount > 10 && allBurns.length <= 10 && (
                <button
                  onClick={loadAllBurns}
                  disabled={loadingAll}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition disabled:opacity-50"
                >
                  {loadingAll ? "Loading..." : "Load All"}
                </button>
              )}
            </div>

            {allBurns.length === 0 ? (
              <p className="text-white/50 text-center py-8">No burn records yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/50 border-b border-white/10">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Week</th>
                      <th className="pb-3 pr-4">Pool</th>
                      <th className="pb-3 pr-4">Reason</th>
                      <th className="pb-3 pr-4">Description</th>
                      <th className="pb-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allBurns.map((burn) => (
                      <tr key={burn.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 pr-4 text-white/60 whitespace-nowrap">
                          {new Date(burn.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-white/50">
                          {burn.weekKey || "-"}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              burn.pool === "XESSEX"
                                ? "bg-cyan-500/20 text-cyan-400"
                                : "bg-orange-500/20 text-orange-400"
                            }`}
                          >
                            {burn.pool}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-white/70 capitalize whitespace-nowrap">
                          {burn.reason.replace(/_/g, " ")}
                        </td>
                        <td className="py-3 pr-4 text-white/50 text-xs max-w-[200px] truncate">
                          {burn.description || "-"}
                        </td>
                        <td className="py-3 text-right text-orange-400 font-medium whitespace-nowrap">
                          {burn.amount} XESS
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Manual Burn Section (Future) */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Manual Burns</h2>
            <p className="text-white/50 text-sm mb-4">
              Record manual token burns (e.g., from treasury burns, buyback-and-burn events).
            </p>
            <button
              disabled
              className="px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 text-sm font-medium cursor-not-allowed opacity-50"
            >
              Record Manual Burn (Coming Soon)
            </button>
          </div>
        </>
      )}
    </main>
  );
}
