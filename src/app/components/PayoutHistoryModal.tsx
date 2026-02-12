"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatXess6 } from "@/lib/formatXess";
import ClaimAllButton from "./ClaimAllButton";

type WeekSummary = {
  weekKey: string;
  total: string;
  pending: string;
  paid: string;
};

type WeeksResponse = {
  ok: boolean;
  weeks: WeekSummary[];
  allTime: { total: string; paid: string; pending: string };
};

function formatWeekLabel(weekKey: string): string {
  const dateStr = weekKey.replace(/-P[12]$/, "");
  const period = weekKey.match(/-P([12])$/)?.[1];
  const d = new Date(dateStr + "T00:00:00Z");
  const label = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return period ? `${label} (P${period})` : label;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PayoutHistoryModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WeeksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/rewards/weeks")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((d: WeeksResponse) => {
        if (d.ok) setData(d);
        else throw new Error("Failed to load");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchData();
  }, [open, fetchData]);

  if (!open) return null;

  const hasUnclaimed = data && BigInt(data.allTime.pending) > 0n;

  return (
    <div className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto overscroll-contain min-h-[100dvh]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl neon-border bg-black/90 p-6 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Image
            src="/logos/textlogo/siteset3/xesstokenpayments.png"
            alt="XESS Payout History"
            width={938}
            height={276}
            className="h-[28px] sm:h-[32px] w-auto"
          />
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition text-xl leading-none p-1"
          >
            &times;
          </button>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm text-center py-8">{error}</div>
        )}

        {data && !loading && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
            {/* All-Time Summary */}
            <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[10px] text-white/40 uppercase tracking-wide">Total Earned</div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {formatXess6(data.allTime.total)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-green-400/70 uppercase tracking-wide">Claimed</div>
                  <div className="text-lg font-bold text-green-400 mt-0.5">
                    {formatXess6(data.allTime.paid)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-yellow-400/70 uppercase tracking-wide">Unclaimed</div>
                  <div className="text-lg font-bold text-yellow-400 mt-0.5">
                    {formatXess6(data.allTime.pending)}
                  </div>
                </div>
              </div>
            </div>

            {/* Claim Button — shown when there are unclaimed rewards */}
            {hasUnclaimed && (
              <ClaimAllButton onSuccess={fetchData} />
            )}

            {/* Week-by-Week List */}
            {data.weeks.length === 0 ? (
              <div className="text-sm text-white/40 text-center py-8">No payouts yet</div>
            ) : (
              <div className="space-y-2">
                {data.weeks.map((w) => {
                  const total = BigInt(w.total);
                  const claimed = BigInt(w.paid);
                  const unclaimed = BigInt(w.pending);
                  const fullyClaimed = total > 0n && unclaimed === 0n && claimed > 0n;
                  const partiallyClaimed = claimed > 0n && unclaimed > 0n;
                  const nothingClaimed = claimed === 0n && total > 0n;

                  return (
                    <div
                      key={w.weekKey}
                      className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/[0.07] transition"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-white">
                          {formatWeekLabel(w.weekKey)}
                        </span>
                        <span className="text-sm font-bold text-purple-300">
                          {formatXess6(w.total)} XESS
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {fullyClaimed && (
                            <span className="inline-flex items-center gap-1 text-xs text-green-400">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Claimed
                            </span>
                          )}
                          {partiallyClaimed && (
                            <span className="text-xs text-amber-400">
                              {formatXess6(w.paid)} claimed, {formatXess6(w.pending)} unclaimed
                            </span>
                          )}
                          {nothingClaimed && (
                            <span className="text-xs text-yellow-400">
                              {formatXess6(w.pending)} ready to claim
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Link to full rewards tab */}
            <div className="pt-2 border-t border-white/10">
              <Link
                href="/profile?tab=history"
                onClick={onClose}
                className="block w-full py-3 rounded-xl bg-purple-500/20 border border-purple-400/50 text-purple-300 font-semibold hover:bg-purple-500/30 transition text-center text-sm"
              >
                View Full Rewards Breakdown →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
