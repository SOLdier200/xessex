"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type UserInfo = {
  id: string;
  username: string | null;
  email: string | null;
  walletAddress: string | null;
};

type LedgerEntry = {
  id: string;
  userId: string;
  user: UserInfo;
  amountMicro: string;
  reason: string | null;
  refType: string;
  refId: string | null;
  weekKey: string | null;
  createdAt: string;
};

type AccrualRun = {
  date: string;
  slot: string;
  count: number;
  totalMicro: string;
};

function formatMicro(micro: string): string {
  const val = Number(micro) / 1000;
  if (val === Math.floor(val)) return val.toFixed(0);
  return val.toFixed(2);
}

function parseRefId(refId: string | null): { dateKey: string; slot: string } | null {
  if (!refId) return null;
  // Format: "userId:dateKey:AM|PM"
  const parts = refId.split(":");
  if (parts.length >= 3) {
    return { dateKey: parts[1], slot: parts[2] };
  }
  return null;
}

function shortWallet(addr: string | null): string {
  if (!addr) return "-";
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

export default function CreditHistoryClient() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [runs, setRuns] = useState<AccrualRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [userFilter, setUserFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [activeUserFilter, setActiveUserFilter] = useState("");
  const [activeDateFilter, setActiveDateFilter] = useState("");
  const [view, setView] = useState<"entries" | "runs">("runs");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "50" });
      if (activeUserFilter) params.set("userId", activeUserFilter);
      if (activeDateFilter) params.set("dateKey", activeDateFilter);

      const res = await fetch(`/api/admin/credit-history?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Failed to load");
        return;
      }
      setEntries(data.entries);
      setRuns(data.runs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [page, activeUserFilter, activeDateFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilters() {
    setPage(1);
    setActiveUserFilter(userFilter.trim());
    setActiveDateFilter(dateFilter.trim());
  }

  function clearFilters() {
    setUserFilter("");
    setDateFilter("");
    setActiveUserFilter("");
    setActiveDateFilter("");
    setPage(1);
  }

  return (
    <main className="min-h-screen p-6 text-white max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold neon-text">Credit Accrual History</h1>
          <p className="text-white/60 text-sm mt-1">
            All special credit accruals across all users
          </p>
        </div>
        <Link
          href="/admin/controls"
          className="px-4 py-2 rounded-full border border-white/30 bg-black/40 text-white text-sm font-semibold hover:bg-white/10 transition"
        >
          Back to Controls
        </Link>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView("runs")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            view === "runs"
              ? "bg-lime-500/20 border border-lime-400/50 text-lime-300"
              : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
          }`}
        >
          Accrual Runs
        </button>
        <button
          onClick={() => setView("entries")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            view === "entries"
              ? "bg-lime-500/20 border border-lime-400/50 text-lime-300"
              : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
          }`}
        >
          Individual Entries
        </button>
      </div>

      {/* ── Accrual Runs View ── */}
      {view === "runs" && (
        <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 bg-white/5">
            <h2 className="font-semibold text-lg">Accrual Runs</h2>
            <p className="text-xs text-white/50 mt-1">
              Each row is a twice-daily accrual run (AM/PM). Click to filter individual entries.
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-white/50">Loading...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-400">{error}</div>
          ) : runs.length === 0 ? (
            <div className="p-8 text-center text-white/50">No accrual runs found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/50 border-b border-white/10">
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Slot</th>
                    <th className="px-5 py-3 font-medium text-right">Users Accrued</th>
                    <th className="px-5 py-3 font-medium text-right">Total Credits</th>
                    <th className="px-5 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr
                      key={`${run.date}:${run.slot}`}
                      className="border-b border-white/5 hover:bg-white/5 transition"
                    >
                      <td className="px-5 py-3 font-mono text-white/90">
                        {run.date || "-"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            run.slot === "AM"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-indigo-500/20 text-indigo-300"
                          }`}
                        >
                          {run.slot || "-"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-white/70">
                        {run.count.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-lime-300">
                        {formatMicro(run.totalMicro)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => {
                            setView("entries");
                            setPage(1);
                            setActiveUserFilter("");
                            setActiveDateFilter(run.date);
                          }}
                          className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition text-white/70"
                        >
                          View Entries
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Individual Entries View ── */}
      {view === "entries" && (
        <>
          {/* Filters */}
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 mb-6">
            <h3 className="font-semibold mb-3 text-white/80">Filters</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-white/50 mb-1">User ID</label>
                <input
                  type="text"
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  placeholder="e.g. clx..."
                  className="rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white w-48"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Date (PT)</label>
                <input
                  type="text"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  placeholder="e.g. 2026-02-13"
                  className="rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white w-40"
                />
              </div>
              <button
                onClick={applyFilters}
                className="px-4 py-2 rounded-xl bg-lime-500/20 border border-lime-400/50 text-lime-300 text-sm font-semibold hover:bg-lime-500/30 transition"
              >
                Apply
              </button>
              {(activeUserFilter || activeDateFilter) && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition"
                >
                  Clear
                </button>
              )}
            </div>
            {(activeUserFilter || activeDateFilter) && (
              <div className="mt-2 text-xs text-white/40">
                Filtering: {activeUserFilter && `user=${activeUserFilter}`}{" "}
                {activeDateFilter && `date=${activeDateFilter}`}
              </div>
            )}
          </div>

          {/* Results */}
          <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg">Accrual Entries</h2>
                <p className="text-xs text-white/50 mt-0.5">
                  {total.toLocaleString()} total entries
                </p>
              </div>
              <div className="text-sm text-white/50">
                Page {page} of {totalPages}
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-white/50">Loading...</div>
            ) : error ? (
              <div className="p-8 text-center text-red-400">{error}</div>
            ) : entries.length === 0 ? (
              <div className="p-8 text-center text-white/50">No entries found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/50 border-b border-white/10">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Slot</th>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Wallet</th>
                      <th className="px-4 py-3 font-medium text-right">Credits</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => {
                      const parsed = parseRefId(e.refId);
                      return (
                        <tr
                          key={e.id}
                          className="border-b border-white/5 hover:bg-white/5 transition"
                        >
                          <td className="px-4 py-3 font-mono text-white/80 whitespace-nowrap">
                            {parsed?.dateKey || new Date(e.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                parsed?.slot === "AM"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-indigo-500/20 text-indigo-300"
                              }`}
                            >
                              {parsed?.slot || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-white/90 font-medium truncate max-w-[160px]">
                              {e.user.username || e.user.email || e.userId.slice(0, 12) + "..."}
                            </div>
                            <div className="text-[10px] text-white/40 font-mono">
                              {e.userId.slice(0, 16)}...
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-white/60 text-xs">
                            {shortWallet(e.user.walletAddress)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-lime-300">
                            +{formatMicro(e.amountMicro)}
                          </td>
                          <td className="px-4 py-3 text-white/50 text-xs max-w-[200px] truncate">
                            {e.reason || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg bg-white/10 text-sm disabled:opacity-30 hover:bg-white/20 transition"
                >
                  Previous
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm transition ${
                          page === pageNum
                            ? "bg-lime-500/30 text-lime-300 font-bold"
                            : "bg-white/5 text-white/50 hover:bg-white/10"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg bg-white/10 text-sm disabled:opacity-30 hover:bg-white/20 transition"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
