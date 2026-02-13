"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import PayoutCountdown from "./PayoutCountdown";
import CreditAccrualCountdown from "./CreditAccrualCountdown";
import CreditManagementModal from "./CreditManagementModal";
import PayoutHistoryModal from "./PayoutHistoryModal";
import { TIER_COLORS, getTierColor } from "@/lib/tierColors";

const TIER_LABELS: Record<number, string> = {
  0: "No Tier",
  1: "Tier 1 (10K)",
  2: "Tier 2 (25K)",
  3: "Tier 3 (50K)",
  4: "Tier 4 (100K)",
  5: "Tier 5 (250K)",
  6: "Tier 6 (500K)",
  7: "Tier 7 (1M)",
  8: "Tier 8 (2.5M)",
  9: "Tier 9 (5M)",
  10: "Tier 10 (10M)",
};

const TIER_THRESHOLDS = [
  0, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000,
  1_000_000, 2_500_000, 5_000_000, 10_000_000,
];

function getTierFromXess(xessBalance: number): number {
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xessBalance >= TIER_THRESHOLDS[i]) return i;
  }
  return 0;
}

const TIER_TABLE = [
  { tier: 1, min: "10,000", monthly: 160 },
  { tier: 2, min: "25,000", monthly: 480 },
  { tier: 3, min: "50,000", monthly: 960 },
  { tier: 4, min: "100,000", monthly: 3200 },
  { tier: 5, min: "250,000", monthly: 8000 },
  { tier: 6, min: "500,000", monthly: 16000 },
  { tier: 7, min: "1,000,000", monthly: 32000 },
  { tier: 8, min: "2,500,000", monthly: 48000 },
  { tier: 9, min: "5,000,000", monthly: 64000 },
  { tier: 10, min: "10,000,000", monthly: 80000 },
];

export default function HomeStatusBar() {
  const { publicKey } = useWallet();
  const [tier, setTier] = useState<number | null>(null);
  const [liveTier, setLiveTier] = useState<number | null>(null);
  const [credits, setCredits] = useState<string | null>(null);
  const [showTiersModal, setShowTiersModal] = useState(false);
  const [showCreditMgmt, setShowCreditMgmt] = useState(false);
  const [showPayoutHistory, setShowPayoutHistory] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ok && data.xessTier !== undefined) {
          setTier(data.xessTier);
          const micro = Number(data.creditBalanceMicro || "0");
          setCredits((micro / 1000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 }));
        }
      })
      .catch(() => {});
  }, []);

  // Fetch live wallet balance when tiers modal opens to get accurate tier
  useEffect(() => {
    if (!showTiersModal || !publicKey) return;
    fetch(`/api/wallet/balances?wallet=${publicKey.toBase58()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          const xess = parseFloat(d.balances.xess.formatted);
          setLiveTier(getTierFromXess(xess));
        }
      })
      .catch(() => {});
  }, [showTiersModal, publicKey]);

  // Only show if user is logged in and we have data
  if (tier === null) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        {/* Credit Tier - clickable → tiers modal */}
        {(() => {
          const tc = getTierColor(tier ?? 0);
          return (
            <button
              onClick={() => setShowTiersModal(true)}
              className={`${tc.bg} border ${tc.border} rounded-lg px-2.5 py-2 sm:px-3 sm:py-2.5 text-left hover:brightness-125 transition cursor-pointer group`}
            >
              <div className={`text-[9px] sm:text-[10px] ${tc.text} opacity-60 uppercase tracking-wide`}>
                Tier
              </div>
              <div className={`text-xs sm:text-sm font-bold ${tc.text} mt-0.5 truncate`}>
                {tier > 0 ? `T${tier}` : "None"}
              </div>
            </button>
          );
        })()}

        {/* Credits - clickable → credit management modal */}
        {credits !== null ? (
          <button
            onClick={() => setShowCreditMgmt(true)}
            className="bg-yellow-500/8 border border-yellow-400/25 rounded-lg px-2.5 py-2 sm:px-3 sm:py-2.5 text-left hover:border-yellow-400/50 hover:bg-yellow-500/15 transition cursor-pointer group"
          >
            <div className="text-[9px] sm:text-[10px] text-yellow-300/60 uppercase tracking-wide">
              Credits
            </div>
            <div className="text-xs sm:text-sm font-bold text-yellow-300 mt-0.5">{credits}</div>
          </button>
        ) : (
          <div />
        )}

        {/* Payout Countdown - clickable → payout history modal */}
        <div className="col-span-2 sm:col-span-1">
          <PayoutCountdown variant="card" showSeconds onClick={() => setShowPayoutHistory(true)} />
        </div>

        {/* Credit Accrual Countdown */}
        <div className="col-span-2 sm:col-span-1">
          <CreditAccrualCountdown variant="card" />
        </div>
      </div>

      {/* Tiers Modal */}
      {showTiersModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center px-2 sm:px-4 py-4 sm:py-6 overflow-y-auto overscroll-contain min-h-[100dvh]">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowTiersModal(false)} />
          <div className="relative w-full max-w-md rounded-2xl neon-border bg-black/95 p-4 sm:p-5 my-auto">
            <button
              onClick={() => setShowTiersModal(false)}
              className="absolute top-3 right-3 text-white/50 hover:text-white transition p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-lg sm:text-xl font-bold text-cyan-400 mb-3 pr-8">Special Credit Earning Formula</h3>

            <p className="text-white/70 text-xs sm:text-sm mb-3">
              Hold XESS tokens to earn Special Credits. Snapshots are taken at random times daily.
            </p>

            {(() => {
              const effectiveTier = liveTier ?? tier ?? 0;
              const tc = getTierColor(effectiveTier);
              return effectiveTier > 0 ? (
                <div className={`mb-3 p-2 sm:p-3 ${tc.bg} border ${tc.border} rounded-xl`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${tc.text.replace("text-", "bg-")} animate-pulse`} />
                    <span className={`${tc.text} text-xs sm:text-sm font-semibold`}>
                      You are Tier {effectiveTier}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mb-3 p-2 sm:p-3 bg-white/5 border border-white/20 rounded-xl">
                  <span className="text-white/50 text-xs sm:text-sm">
                    Hold 10k+ XESS to start earning
                  </span>
                </div>
              );
            })()}

            <div className="space-y-1.5 mb-3 max-h-[40vh] sm:max-h-none overflow-y-auto">
              {TIER_TABLE.map((t) => {
                const isCurrentTier = (liveTier ?? tier) === t.tier;
                const tc = getTierColor(t.tier);
                return (
                  <div
                    key={t.tier}
                    className={`rounded-lg p-2 sm:p-2.5 flex justify-between items-center transition-all ${
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
                      <span className={`text-xs sm:text-sm font-bold ${tc.text} mr-1.5`}>
                        T{t.tier}
                      </span>
                      <span className={`text-xs sm:text-sm font-semibold ${isCurrentTier ? "text-white" : "text-white/90"}`}>
                        {t.min}+ XESS
                      </span>
                    </div>
                    <span className={`text-xs sm:text-sm font-bold ${tc.text}`}>
                      {(t.monthly / 30).toLocaleString(undefined, { maximumFractionDigits: 1 })}/day
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="p-2.5 sm:p-3 bg-yellow-500/10 border border-yellow-400/30 rounded-xl mb-3">
              <p className="text-yellow-300 text-xs">
                Snapshots are taken at random times daily. Keep your balance consistent!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                href="/rewards-drawing"
                onClick={() => setShowTiersModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-400 font-semibold hover:bg-cyan-500/30 transition text-center text-sm"
              >
                Rewards Drawing
              </Link>
              <button
                onClick={() => {
                  setShowTiersModal(false);
                  setShowCreditMgmt(true);
                }}
                className="flex-1 py-2.5 rounded-xl bg-purple-500/20 border border-purple-400/50 text-purple-400 font-semibold hover:bg-purple-500/30 transition text-sm"
              >
                My Ranking
              </button>
              <button
                onClick={() => setShowTiersModal(false)}
                className="py-2.5 px-4 rounded-xl bg-white/5 border border-white/20 text-white/70 font-semibold hover:bg-white/10 transition text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Ranking Modal */}
      <CreditManagementModal
        open={showCreditMgmt}
        onClose={() => setShowCreditMgmt(false)}
      />

      {/* Payout History Modal */}
      <PayoutHistoryModal
        open={showPayoutHistory}
        onClose={() => setShowPayoutHistory(false)}
      />
    </>
  );
}
