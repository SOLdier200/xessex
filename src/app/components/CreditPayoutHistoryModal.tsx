"use client";

import { useCallback, useEffect, useState } from "react";
import { getTierColor } from "@/lib/tierColors";

type Entry = {
  id: string;
  time: string;
  amount: number;
  amountMicro: string;
  tier: number;
  createdAt: string;
};

type DayGroup = {
  date: string;
  entries: Entry[];
};

type RecentResponse = {
  ok: boolean;
  recent: DayGroup[];
  months: string[];
};

type MonthResponse = {
  ok: boolean;
  month: string;
  days: DayGroup[];
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function TierBadge({ tier }: { tier: number }) {
  if (tier === 0) return null;
  const tc = getTierColor(tier);
  return (
    <span className={`text-[10px] font-bold ${tc.text} bg-gradient-to-r ${tc.badge} border rounded px-1 py-0.5 leading-none`}>
      T{tier}
    </span>
  );
}

function DayEntries({ day }: { day: DayGroup }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
      <div className="text-xs font-semibold text-white/70 mb-2">{formatDate(day.date)}</div>
      <div className="space-y-1.5">
        {day.entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/40 w-6">{e.time}</span>
              <TierBadge tier={e.tier} />
            </div>
            <span className="text-sm font-semibold text-yellow-300">
              +{e.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreditPayoutHistoryModal({ open, onClose }: Props) {
  const [view, setView] = useState<"recent" | "full">("recent");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recent view data
  const [recentDays, setRecentDays] = useState<DayGroup[]>([]);
  const [months, setMonths] = useState<string[]>([]);

  // Full view data
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [monthDays, setMonthDays] = useState<DayGroup[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);

  const fetchRecent = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/credits/payouts")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((d: RecentResponse) => {
        if (d.ok) {
          setRecentDays(d.recent);
          setMonths(d.months);
          if (d.months.length > 0 && !selectedMonth) {
            setSelectedMonth(d.months[0]);
          }
        } else {
          throw new Error("Failed to load");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedMonth]);

  const fetchMonth = useCallback((m: string) => {
    setMonthLoading(true);
    fetch(`/api/credits/payouts?month=${m}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((d: MonthResponse) => {
        if (d.ok) setMonthDays(d.days);
      })
      .catch(() => {})
      .finally(() => setMonthLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    setView("recent");
    fetchRecent();
  }, [open, fetchRecent]);

  useEffect(() => {
    if (view === "full" && selectedMonth) {
      fetchMonth(selectedMonth);
    }
  }, [view, selectedMonth, fetchMonth]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto overscroll-contain min-h-[100dvh]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl neon-border bg-black/90 p-5 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {view === "full" && (
              <button
                onClick={() => setView("recent")}
                className="text-white/50 hover:text-white transition p-1"
                title="Back"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-lg font-semibold text-yellow-300">
              {view === "recent" ? "Credit Payouts" : "Full Credit History"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition text-xl leading-none p-1"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        {loading && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm text-center py-8">{error}</div>
        )}

        {!loading && !error && view === "recent" && (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {recentDays.length === 0 ? (
              <div className="text-sm text-white/40 text-center py-8">No credit payouts yet</div>
            ) : (
              recentDays.map((day) => <DayEntries key={day.date} day={day} />)
            )}

            {/* View full history button */}
            {months.length > 0 && (
              <div className="pt-2 border-t border-white/10">
                <button
                  onClick={() => setView("full")}
                  className="block w-full py-3 rounded-xl bg-yellow-500/15 border border-yellow-400/40 text-yellow-300 font-semibold hover:bg-yellow-500/25 transition text-center text-sm"
                >
                  View Entire Credit Payout History
                </button>
              </div>
            )}
          </div>
        )}

        {!loading && !error && view === "full" && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
            {/* Month selector */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white appearance-none cursor-pointer hover:bg-white/15 transition"
            >
              {months.map((m) => (
                <option key={m} value={m} className="bg-gray-900 text-white">
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>

            {monthLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : monthDays.length === 0 ? (
              <div className="text-sm text-white/40 text-center py-8">No entries this month</div>
            ) : (
              monthDays.map((day) => <DayEntries key={day.date} day={day} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
