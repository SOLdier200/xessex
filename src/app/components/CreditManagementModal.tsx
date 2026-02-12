"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { TIER_COLORS, getTierColor } from "@/lib/tierColors";
import CreditPayoutHistoryModal from "./CreditPayoutHistoryModal";
import PayoutHistoryModal from "./PayoutHistoryModal";

// Tier thresholds in whole XESS tokens
const TIER_THRESHOLDS = [
  0, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000,
  1_000_000, 2_500_000, 5_000_000, 10_000_000,
];
const TIER_MONTHLY_CREDITS = [
  0, 160, 480, 960, 3_200, 8_000, 16_000, 32_000, 48_000, 64_000, 80_000,
];

function getTierFromXess(xessBalance: number): number {
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xessBalance >= TIER_THRESHOLDS[i]) return i;
  }
  return 0;
}

interface CreditEntry {
  id: string;
  createdAt: string;
  amountMicro: string;
  amountDisplay: number;
  reason: string;
  refType: string;
}

interface CreditHistoryData {
  balanceDisplay: number;
  xessBalance: number;
  tier: number;
  tierInfo: {
    minBalanceXess: number;
    monthlyCredits: number;
    nextTier: number | null;
    nextTierMinXess: number | null;
    nextTierMonthlyCredits: number | null;
  };
  entries: CreditEntry[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

// TIER_COLORS imported from @/lib/tierColors

const TIERS = [
  { tier: 1, min: "10,000", monthlyCredits: 160 },
  { tier: 2, min: "25,000", monthlyCredits: 480 },
  { tier: 3, min: "50,000", monthlyCredits: 960 },
  { tier: 4, min: "100,000", monthlyCredits: 3200 },
  { tier: 5, min: "250,000", monthlyCredits: 8000 },
  { tier: 6, min: "500,000", monthlyCredits: 16000 },
  { tier: 7, min: "1,000,000", monthlyCredits: 32000 },
  { tier: 8, min: "2,500,000", monthlyCredits: 48000 },
  { tier: 9, min: "5,000,000", monthlyCredits: 64000 },
  { tier: 10, min: "10,000,000", monthlyCredits: 80000 },
];

function formatRefType(refType: string): string {
  switch (refType) {
    case "DAILY_ACCRUAL":
      return "Daily Accrual";
    case "RAFFLE_BUY_CREDITS":
      return "Drawing Entry";
    case "RAFFLE_PRIZE_CREDITS":
      return "Drawing Prize";
    case "ADMIN_GRANT":
      return "Admin Grant";
    case "ADMIN_DEDUCT":
      return "Admin Deduction";
    case "MEMBERSHIP_REDEEM":
      return "Membership";
    default:
      return refType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function groupByDay(entries: CreditEntry[]): { date: string; entries: CreditEntry[] }[] {
  const groups: Map<string, CreditEntry[]> = new Map();
  for (const entry of entries) {
    const date = new Date(entry.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(entry);
  }
  return Array.from(groups.entries()).map(([date, entries]) => ({ date, entries }));
}

export default function CreditManagementModal({ open, onClose }: Props) {
  const { publicKey } = useWallet();
  const [data, setData] = useState<CreditHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTiers, setShowTiers] = useState(false);
  const [showCreditPayoutHistory, setShowCreditPayoutHistory] = useState(false);
  const [showXessPayoutHistory, setShowXessPayoutHistory] = useState(false);
  const [liveXess, setLiveXess] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setLiveXess(null);

    // Fetch credit history and live wallet balance in parallel
    const creditsFetch = fetch("/api/credits/history")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      });

    const walletFetch = publicKey
      ? fetch(`/api/wallet/balances?wallet=${publicKey.toBase58()}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.ok) {
              const xessFormatted = parseFloat(d.balances.xess.formatted);
              setLiveXess(xessFormatted);
            }
          })
          .catch(() => {}) // silent fail, will use credits/history data
      : Promise.resolve();

    Promise.all([creditsFetch, walletFetch])
      .then(([creditsData]) => setData(creditsData))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, publicKey]);

  if (!open) return null;

  // Use live wallet balance when available, otherwise fall back to API data
  const xessBalance = liveXess ?? data?.xessBalance ?? 0;
  const effectiveTier = liveXess !== null ? getTierFromXess(liveXess) : (data?.tier ?? 0);
  const effectiveMonthlyCredits = TIER_MONTHLY_CREDITS[effectiveTier] ?? 0;
  const effectiveNextTier = effectiveTier < TIER_THRESHOLDS.length - 1 ? effectiveTier + 1 : null;
  const effectiveNextTierMinXess = effectiveNextTier !== null ? TIER_THRESHOLDS[effectiveNextTier] : null;
  const effectiveNextTierMonthlyCredits = effectiveNextTier !== null ? TIER_MONTHLY_CREDITS[effectiveNextTier] : null;

  // Calculate per-accrual amount for display
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const perAccrual =
    effectiveMonthlyCredits > 0
      ? (effectiveMonthlyCredits / (daysInMonth * 2)).toFixed(2)
      : "0";

  const grouped = data ? groupByDay(data.entries) : [];

  return (
    <div className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl neon-border bg-black/90 p-4 sm:p-6 max-h-[80vh] sm:max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Credit Ranking</h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition text-xl leading-none p-1"
          >
            &times;
          </button>
        </div>

        <p className="text-sm font-semibold mb-4 leading-relaxed">
          {"Hold 10k+ Xess Tokens to start earning credits".split("").map((char, i) => (
            <span
              key={i}
              className="inline-block rainbow-letter"
              style={{
                animationDelay: `${i * 0.07}s`,
              }}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          ))}
        </p>
        <style jsx>{`
          @keyframes rainbowShift {
            0%   { color: #ec4899; }
            14%  { color: #a855f7; }
            28%  { color: #06b6d4; }
            42%  { color: #22c55e; }
            57%  { color: #eab308; }
            71%  { color: #f97316; }
            85%  { color: #ef4444; }
            100% { color: #ec4899; }
          }
          .rainbow-letter {
            animation: rainbowShift 2.5s ease-in-out infinite;
          }
        `}</style>

        {loading && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm text-center py-8">{error}</div>
        )}

        {data && !loading && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
            {/* Balance */}
            <div className="bg-yellow-500/10 rounded-xl p-4 text-center">
              <div className="text-xs text-white/50 uppercase tracking-wide mb-1">
                Current Credit Balance
              </div>
              <div className="text-3xl font-bold text-yellow-400">
                {data.balanceDisplay.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Tier Info */}
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <button
                onClick={() => setShowTiers(true)}
                className="flex items-center justify-between w-full hover:bg-white/5 rounded-lg -mx-1 px-1 py-0.5 transition cursor-pointer group"
              >
                <span className="text-sm text-white/70 flex items-center gap-1">
                  Current Tier
                  <span className="text-white/30 group-hover:text-white/50 transition text-xs">→</span>
                </span>
                <span className={`px-2 py-0.5 rounded-full bg-gradient-to-r border text-sm font-semibold ${TIER_COLORS[effectiveTier]?.badge ?? TIER_COLORS[0].badge}`}>
                  {effectiveTier === 0 ? "No Tier" : `Tier ${effectiveTier}`}
                </span>
              </button>

              <button
                onClick={() => setShowXessPayoutHistory(true)}
                className="flex items-center justify-between w-full hover:bg-white/5 rounded-lg -mx-1 px-1 py-0.5 transition cursor-pointer group"
              >
                <span className="text-sm text-white/70 flex items-center gap-1">
                  XESS Holdings
                  <span className="text-white/30 group-hover:text-white/50 transition text-xs">→</span>
                </span>
                <span className="text-sm font-medium text-cyan-400">
                  {xessBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} XESS
                </span>
              </button>

              <button
                onClick={() => setShowCreditPayoutHistory(true)}
                className="flex items-center justify-between w-full hover:bg-white/5 rounded-lg -mx-1 px-1 py-0.5 transition cursor-pointer group"
              >
                <span className="text-sm text-white/70 flex items-center gap-1">
                  Daily Credits
                  <span className="text-white/30 group-hover:text-white/50 transition text-xs">→</span>
                </span>
                <span className="text-sm font-medium text-yellow-400">
                  {(effectiveMonthlyCredits / daysInMonth).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </span>
              </button>

              {effectiveNextTier !== null && (
                <button
                  onClick={() => setShowTiers(true)}
                  className="w-full pt-2 border-t border-white/10 text-left hover:bg-white/5 rounded-b-lg transition -mx-1 px-1 cursor-pointer group"
                >
                  <div className="text-xs text-cyan-400 mb-1 flex items-center gap-1">
                    Next Tier: Tier {effectiveNextTier}
                    <span className="text-white/30 group-hover:text-white/50 transition">→ View All Tiers</span>
                  </div>
                  <div className="text-xs text-white/50">
                    Hold{" "}
                    <span className="text-cyan-400 font-medium">
                      {effectiveNextTierMinXess!.toLocaleString()} XESS
                    </span>
                    {" "}for{" "}
                    <span className="text-yellow-400 font-medium">
                      {(effectiveNextTierMonthlyCredits! / daysInMonth).toLocaleString(undefined, { maximumFractionDigits: 1 })} credits/day
                    </span>
                  </div>
                </button>
              )}
            </div>

            {/* Accrual Schedule */}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-xs text-white/50 uppercase tracking-wide mb-2">Accrual Schedule</div>
              <div className="text-sm text-white/70">
                Credits accrue <span className="text-white font-medium">twice daily</span> (AM &amp; PM, PT timezone)
              </div>
              {effectiveTier > 0 && (
                <div className="mt-2 text-sm text-white/50">
                  ~<span className="text-yellow-400 font-medium">{perAccrual}</span> credits per accrual
                  <span className="text-white/30"> ({daysInMonth} days this month)</span>
                </div>
              )}
            </div>

            {/* Credits Spent */}
            <div>
              <div className="text-xs text-red-400/70 uppercase tracking-wide mb-2">Credits Spent</div>
              {data.entries.filter((e) => e.amountDisplay < 0).length === 0 ? (
                <div className="text-sm text-white/30 text-center py-3">No credits spent yet</div>
              ) : (
                <div className="space-y-3">
                  {groupByDay(data.entries.filter((e) => e.amountDisplay < 0)).map((group) => (
                    <div key={group.date}>
                      <div className="text-xs text-white/40 mb-1.5 sticky top-0 bg-black/90 py-1">
                        {group.date}
                      </div>
                      <div className="space-y-1">
                        {group.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 transition"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-white/80 truncate">
                                {formatRefType(entry.refType)}
                              </div>
                              <div className="text-xs text-white/30">
                                {new Date(entry.createdAt).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true,
                                })}
                              </div>
                            </div>
                            <div className="text-sm font-medium ml-3 text-red-400">
                              {Math.abs(entry.amountDisplay).toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Credit Payout History Modal — sits on top at z-[80] */}
      <CreditPayoutHistoryModal
        open={showCreditPayoutHistory}
        onClose={() => setShowCreditPayoutHistory(false)}
      />

      {/* XESS Payout History Modal — sits on top at z-[80] */}
      <PayoutHistoryModal
        open={showXessPayoutHistory}
        onClose={() => setShowXessPayoutHistory(false)}
      />

      {/* Tier Rates Modal — sits on top at z-[80] */}
      {showTiers && (
        <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh]">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowTiers(false)} />
          <div className="relative w-full max-w-md rounded-2xl neon-border bg-black/95 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-cyan-400">Credit Tier Rates</h3>
              <button
                onClick={() => setShowTiers(false)}
                className="text-white/50 hover:text-white transition text-xl leading-none p-1"
              >
                &times;
              </button>
            </div>

            <p className="text-white/60 text-xs mb-3">
              Hold XESS tokens to earn Special Credits. Higher tiers earn more credits per day.
            </p>

            {/* Current tier indicator */}
            {effectiveTier > 0 && (() => {
              const tc = TIER_COLORS[effectiveTier] ?? TIER_COLORS[1];
              return (
                <div className={`mb-3 p-2 ${tc.bg} border ${tc.border} rounded-xl`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${tc.text.replace("text-", "bg-")} animate-pulse`} />
                    <span className={`${tc.text} text-xs font-semibold`}>
                      You are Tier {effectiveTier}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-1.5 max-h-[40vh] sm:max-h-[50vh] overflow-y-auto overscroll-contain">
              {TIERS.map((t) => {
                const isCurrentTier = effectiveTier === t.tier;
                const tc = TIER_COLORS[t.tier] ?? TIER_COLORS[1];
                return (
                  <div
                    key={t.tier}
                    className={`rounded-lg p-2.5 flex justify-between items-center transition-all ${
                      isCurrentTier
                        ? `${tc.bg} border-2 ${tc.border} shadow-lg`
                        : `${tc.bg} border ${tc.border}`
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isCurrentTier && (
                        <svg className={`w-4 h-4 ${tc.text} flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={`text-sm font-bold ${tc.text} mr-1`}>
                        T{t.tier}
                      </span>
                      <span className={`text-sm font-semibold ${isCurrentTier ? "text-white" : "text-white/90"}`}>
                        {t.min}+ XESS
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${tc.text}`}>
                      {(t.monthlyCredits / daysInMonth).toLocaleString(undefined, { maximumFractionDigits: 1 })}/day
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setShowTiers(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-white/5 border border-white/20 text-white/70 font-semibold hover:bg-white/10 transition text-sm"
            >
              Back to Credit Ranking
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
