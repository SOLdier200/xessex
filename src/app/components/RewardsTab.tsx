"use client";

import { useEffect, useState } from "react";
import { formatXess, rewardTypeLabel } from "@/lib/formatXess";

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
        <div className="text-sm text-gray-400 mb-1">All-Time Earnings</div>
        <div className="text-2xl font-bold text-white">
          {formatXess(allTime.total)} <span className="text-purple-400">XESS</span>
        </div>
        {BigInt(allTime.paid) > 0n && (
          <div className="text-sm text-green-400 mt-1">
            {formatXess(allTime.paid)} XESS paid out
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
            <div className="text-sm text-gray-400 mb-1">
              Week of {formatWeekLabel(weekDetail.weekKey)}
            </div>
            <div className="text-xl font-bold text-white">
              {formatXess(weekDetail.totals.total)} XESS
            </div>
            <div className="flex gap-4 mt-2 text-sm">
              {BigInt(weekDetail.totals.pending) > 0n && (
                <span className="text-yellow-400">
                  {formatXess(weekDetail.totals.pending)} pending
                </span>
              )}
              {BigInt(weekDetail.totals.paid) > 0n && (
                <span className="text-green-400">
                  {formatXess(weekDetail.totals.paid)} paid
                </span>
              )}
            </div>
          </div>

          {/* Breakdown by Type */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-400">Breakdown</h4>
            {Object.entries(weekDetail.byType).map(([type, data]) => (
              <div
                key={type}
                className="flex items-center justify-between bg-gray-800/30 rounded-lg p-3"
              >
                <div className="flex items-center gap-2">
                  <TypeIcon type={type} />
                  <span className="text-white">{rewardTypeLabel(type)}</span>
                </div>
                <div className="text-right">
                  <div className="text-white font-medium">
                    {formatXess(data.amount)} XESS
                  </div>
                  <div
                    className={`text-xs ${
                      data.status === "PAID" ? "text-green-400" : "text-yellow-400"
                    }`}
                  >
                    {data.status === "PAID" ? "Paid" : "Pending"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TypeIcon({ type }: { type: string }) {
  const iconClass = "w-5 h-5";

  switch (type) {
    case "WEEKLY_LIKES":
      return (
        <svg className={`${iconClass} text-pink-400`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
        </svg>
      );
    case "WEEKLY_MVM":
      return (
        <svg className={`${iconClass} text-yellow-400`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    case "WEEKLY_COMMENTS":
      return (
        <svg className={`${iconClass} text-cyan-400`} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "REF_L1":
    case "REF_L2":
    case "REF_L3":
      return (
        <svg className={`${iconClass} text-green-400`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      );
    default:
      return (
        <svg className={`${iconClass} text-gray-400`} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
}
