"use client";

import { useEffect, useState } from "react";
import { formatXess6, rewardTypeLabel } from "@/lib/formatXess";

type WeekSummary = {
  weekKey: string;
  total: string;
  pending: string;
  paid: string;
};

type WeeksResponse = {
  ok: boolean;
  weeks: WeekSummary[];
  allTime: { total: string; paid: string };
};

type RewardDetail = {
  id: string;
  type: string;
  refType: string | null;
  amount: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  txSig: string | null;
};

type WeekDetailResponse = {
  ok: boolean;
  weekKey: string;
  rewards: RewardDetail[];
  byType: Record<string, { amount: string; status: string; count: number }>;
  totals: { total: string; pending: string; paid: string };
};

function formatWeekLabel(weekKey: string): string {
  // Strip period suffix (-P1 / -P2) if present
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

function solanaExplorerTxUrl(sig: string) {
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "mainnet-beta";
  const qp = cluster === "mainnet-beta" ? "" : `?cluster=${encodeURIComponent(cluster)}`;
  return `https://explorer.solana.com/tx/${sig}${qp}`;
}

/** Referral level colors matching the Referrals tab */
function getRefLevelColor(type: string): string | null {
  switch (type) {
    case "REF_L1": return "text-purple-400";
    case "REF_L2": return "text-pink-400";
    case "REF_L3": return "text-yellow-400";
    default: return null;
  }
}


export default function RewardsTab() {
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<WeekSummary[]>([]);
  const [allTime, setAllTime] = useState({ total: "0", paid: "0" });
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [weekDetail, setWeekDetail] = useState<WeekDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetch("/api/rewards/weeks")
      .then((r) => r.json())
      .then((data: WeeksResponse) => {
        if (data.ok) {
          setWeeks(data.weeks);
          setAllTime(data.allTime);
          if (data.weeks.length > 0) {
            // Prefer previous week if the latest week is the current ongoing week
            // (so users see a completed payout breakdown by default)
            const now = new Date();
            const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            const day = today.getUTCDay();
            const diffToMonday = (day + 6) % 7;
            today.setUTCDate(today.getUTCDate() - diffToMonday);
            const currentWeekKey = today.toISOString().slice(0, 10);

            const first = data.weeks[0].weekKey;
            const second = data.weeks[1]?.weekKey;

            setSelectedWeek(first === currentWeekKey && second ? second : first);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedWeek) return;
    setLoadingDetail(true);
    fetch(`/api/rewards/week?weekKey=${selectedWeek}`)
      .then((r) => r.json())
      .then((data: WeekDetailResponse) => {
        if (data.ok) {
          setWeekDetail(data);
        }
      })
      .finally(() => setLoadingDetail(false));
  }, [selectedWeek]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-2">No rewards yet</p>
        <p className="text-gray-500 text-sm">
          Earn XESS by getting likes on your comments, MVM points, or referring friends.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* All-Time Summary */}
      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg p-4 overflow-hidden">
        <div className="text-sm text-gray-400 mb-1">All-Time History</div>
        <div className="text-2xl font-bold text-white whitespace-nowrap">
          {formatXess6(allTime.total)} <span className="text-purple-400">XESS</span>
        </div>
        {BigInt(allTime.paid) > 0n && (
          <div className="text-sm text-green-400 mt-1">
            {formatXess6(allTime.paid)} XESS paid
          </div>
        )}
      </div>

      {/* Week Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {weeks.map((w) => (
          <button
            key={w.weekKey}
            onClick={() => setSelectedWeek(w.weekKey)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm transition-colors ${
              selectedWeek === w.weekKey
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {formatWeekLabel(w.weekKey)}
          </button>
        ))}
      </div>

      {/* Week Detail */}
      {loadingDetail ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
        </div>
      ) : weekDetail ? (
        <div className="space-y-4">
          {/* Week Totals */}
          <div className="bg-gray-800/50 rounded-lg p-4 overflow-hidden">
            <div>
              <div className="text-sm text-gray-400 mb-1 truncate">
                Week of {formatWeekLabel(weekDetail.weekKey)}
              </div>
              <div className="text-xl font-bold text-white whitespace-nowrap">
                {formatXess6(weekDetail.totals.total)} XESS
              </div>
            </div>

            <div className="flex gap-4 mt-2 text-sm">
              {BigInt(weekDetail.totals.pending) > 0n && (
                <span className="text-yellow-400">
                  {formatXess6(weekDetail.totals.pending)} pending
                </span>
              )}
              {BigInt(weekDetail.totals.paid) > 0n && (
                <span className="text-green-400">
                  {formatXess6(weekDetail.totals.paid)} paid
                </span>
              )}
            </div>
          </div>

          {/* Pool Breakdown */}
          {weekDetail.byType && Object.keys(weekDetail.byType).length > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-3">Pool Breakdown</div>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(weekDetail.byType).map(([type, data]) => {
                  // Strip pool suffix for ref color lookup
                  const baseType = type.replace(/:(?:xessex|embed)$/, "");
                  const refColor = getRefLevelColor(baseType);
                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between bg-gray-700/30 rounded-lg px-3 py-2 overflow-hidden min-w-0"
                    >
                      <div className={`text-sm truncate mr-2 ${refColor ?? "text-gray-300"}`}>{rewardTypeLabel(baseType, (data as any).refType)}</div>
                      <div className={`text-sm font-medium flex-shrink-0 ${refColor ?? "text-white"}`}>
                        {formatXess6(data.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* History */}
          <div className="space-y-2">
            {weekDetail.rewards.map((r) => {
              const isPaid = r.status === "PAID";
              const refColor = getRefLevelColor(r.type);
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between bg-gray-800/30 rounded-lg p-3 overflow-hidden"
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <div className={`text-sm truncate ${refColor ?? "text-white"}`}>{rewardTypeLabel(r.type, r.refType)}</div>
                    <div className="text-xs text-white/50 truncate">
                      {new Date(r.createdAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 max-w-[45%]">
                    <div className={`font-medium text-sm whitespace-nowrap ${refColor ?? "text-white"}`}>{formatXess6(r.amount)} XESS</div>

                    {isPaid ? (
                      r.txSig ? (
                        <a
                          href={solanaExplorerTxUrl(r.txSig)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-green-400 hover:underline truncate block"
                          title={r.txSig}
                        >
                          Claimed
                        </a>
                      ) : (
                        <div className="text-xs text-green-400">Paid</div>
                      )
                    ) : (
                      <div className="text-xs text-yellow-400">Pending</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

