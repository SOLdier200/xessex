"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TopNav from "../components/TopNav";

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
  recentBurns: {
    id: string;
    weekKey: string | null;
    pool: string;
    reason: string;
    amount: string;
    description: string | null;
    txSig: string | null;
    createdAt: string;
  }[];
};

export default function BurnedPage() {
  const [data, setData] = useState<BurnSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/burns/summary")
      .then((res) => res.json())
      .then((d) => {
        if (d.ok) {
          setData(d);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-4 md:px-6 pb-10 max-w-4xl mx-auto">
        <Link
          href="/"
          className="text-gray-400 hover:text-white mb-6 inline-block text-sm"
        >
          &larr; Back to Home
        </Link>

        {/* Header */}
        <section className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className="absolute inset-0 blur-xl scale-150 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(239,68,68,0.35) 0%, rgba(249,115,22,0.2) 50%, transparent 70%)",
                }}
              />
              <div className="relative w-16 h-16 flex items-center justify-center text-4xl">
                🔥
              </div>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                XESS Token Burns
              </h1>
              <p className="text-white/60 text-sm mt-1">
                Tracking deflationary token burns
              </p>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="neon-border rounded-2xl p-8 bg-black/30 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-white/60">Loading burn data...</p>
          </div>
        ) : !data ? (
          <div className="neon-border rounded-2xl p-8 bg-black/30 text-center">
            <p className="text-white/60">Failed to load burn data</p>
          </div>
        ) : (
          <>
            {/* Main Stats */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="neon-border rounded-2xl p-6 bg-gradient-to-br from-orange-500/10 to-red-500/10 text-center">
                <div className="text-3xl md:text-4xl font-bold text-orange-400">
                  {data.totalBurned}
                </div>
                <div className="text-sm text-white/60 mt-1">Total XESS Burned</div>
              </div>

              <div className="neon-border rounded-2xl p-6 bg-black/30 text-center">
                <div className="text-3xl md:text-4xl font-bold text-white">
                  {data.burnPercentage}%
                </div>
                <div className="text-sm text-white/60 mt-1">Of Total Supply</div>
              </div>

              <div className="neon-border rounded-2xl p-6 bg-black/30 text-center">
                <div className="text-3xl md:text-4xl font-bold text-white">
                  {data.burnCount}
                </div>
                <div className="text-sm text-white/60 mt-1">Burn Events</div>
              </div>
            </section>

            {/* Supply Info */}
            <section className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4">Supply Breakdown</h2>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/60">Total Supply</span>
                    <span className="text-white">{data.totalSupply} XESS</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-pink-500 h-3 rounded-full"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/60">Total Burned</span>
                    <span className="text-orange-400">{data.totalBurned} XESS</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full transition-all"
                      style={{ width: `${Math.min(parseFloat(data.burnPercentage), 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Burns by Pool */}
            <section className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4">Burns by Pool</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
                  <div className="text-xs text-cyan-400 uppercase tracking-wide mb-1">Xessex Pool</div>
                  <div className="text-2xl font-bold text-white">{data.byPool.XESSEX} XESS</div>
                  <div className="text-xs text-white/50 mt-1">Premium content rewards</div>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                  <div className="text-xs text-orange-400 uppercase tracking-wide mb-1">Embed Pool</div>
                  <div className="text-2xl font-bold text-white">{data.byPool.EMBED} XESS</div>
                  <div className="text-xs text-white/50 mt-1">Embedded video rewards</div>
                </div>
              </div>
            </section>

            {/* Burns by Reason */}
            {Object.keys(data.byReason).length > 0 && (
              <section className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">Burns by Reason</h2>

                <div className="space-y-2">
                  {Object.entries(data.byReason).map(([reason, amount]) => (
                    <div key={reason} className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-white/70 capitalize">{reason.replace(/_/g, " ")}</span>
                      <span className="text-orange-400 font-medium">{amount} XESS</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Burns */}
            {data.recentBurns.length > 0 && (
              <section className="neon-border rounded-2xl p-6 bg-black/30">
                <h2 className="text-lg font-semibold text-white mb-4">Recent Burns</h2>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-white/50 border-b border-white/10">
                        <th className="pb-3 pr-4">Date</th>
                        <th className="pb-3 pr-4">Pool</th>
                        <th className="pb-3 pr-4">Reason</th>
                        <th className="pb-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentBurns.map((burn) => (
                        <tr key={burn.id} className="border-b border-white/5">
                          <td className="py-3 pr-4 text-white/60">
                            {new Date(burn.createdAt).toLocaleDateString()}
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
                          <td className="py-3 pr-4 text-white/70 capitalize">
                            {burn.reason.replace(/_/g, " ")}
                          </td>
                          <td className="py-3 text-right text-orange-400 font-medium">
                            {burn.amount} XESS
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Info Box */}
            <section className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-sm text-white/50">
                <span className="text-white/70 font-medium">About XESS Burns:</span> Unused weekly emissions
                are automatically burned. When the allocated rewards for a pool exceed what users actually earn,
                the difference is burned, making XESS deflationary over time.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
