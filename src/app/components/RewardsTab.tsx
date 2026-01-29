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
  const d = new Date(weekKey + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function shortenSig(sig: string, left = 6, right = 6) {
  if (!sig) return "";
  if (sig.length <= left + right + 3) return sig;
  return `${sig.slice(0, left)}...${sig.slice(-right)}`;
}

function solanaExplorerTxUrl(sig: string) {
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "mainnet-beta";
  const qp = cluster === "mainnet-beta" ? "" : `?cluster=${encodeURIComponent(cluster)}`;
  return `https://explorer.solana.com/tx/${sig}${qp}`;
}

function csvEscape(val: string) {
  return `"${String(val ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
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
      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg p-4">
        <div className="text-sm text-gray-400 mb-1">All-Time History</div>
        <div className="text-2xl font-bold text-white">
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
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-gray-400 mb-1">
                  Week of {formatWeekLabel(weekDetail.weekKey)}
                </div>
                <div className="text-xl font-bold text-white">
                  {formatXess6(weekDetail.totals.total)} XESS
                </div>
              </div>

              <button
                onClick={() => {
                  const rows: string[][] = [
                    ["createdAt", "type", "amount", "status", "paidAt", "txSig"],
                    ...weekDetail.rewards.map((r) => [
                      r.createdAt,
                      r.type,
                      r.amount,
                      r.status,
                      r.paidAt ?? "",
                      r.txSig ?? "",
                    ]),
                  ];

                  downloadCsv(`xessex-history-${weekDetail.weekKey}.csv`, rows);
                }}
                disabled={!weekDetail.rewards?.length}
                className="px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-400/50 text-purple-300 font-semibold hover:bg-purple-500/30 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                title="Export individual history rows for this week"
              >
                Export CSV
              </button>
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

          {/* History */}
          <div className="space-y-2">
            {weekDetail.rewards.map((r) => {
              const isPaid = r.status === "PAID";
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between bg-gray-800/30 rounded-lg p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="text-white truncate">{rewardTypeLabel(r.type)}</div>
                      <div className="text-xs text-white/50">
                        {new Date(r.createdAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-white font-medium">{formatXess6(r.amount)} XESS</div>

                    {isPaid ? (
                      r.txSig ? (
                        <a
                          href={solanaExplorerTxUrl(r.txSig)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-green-400 hover:underline"
                          title={r.txSig}
                        >
                          Claimed • View Tx {shortenSig(r.txSig)}
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

