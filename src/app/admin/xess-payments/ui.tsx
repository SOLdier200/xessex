"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatXess6, rewardTypeLabel } from "@/lib/formatXess";

/* ── Types ── */

type Period = {
  weekKey: string;
  totalAmount: string;
  totalUsers: number;
  finishedAt: string | null;
  createdAt: string;
  claimedUsers: number;
  totalUsersWithRewards: number;
};

type UserRow = {
  userId: string;
  username: string | null;
  email: string | null;
  walletAddress: string | null;
  total: string;
  eventCount: number;
  claimed: boolean;
};

type EventRow = {
  id: string;
  type: string;
  amount: string;
  status: string;
  refType: string;
  refId: string;
  claimedAt: string | null;
  createdAt: string;
};

/* ── Helpers ── */

function shortWallet(addr: string | null): string {
  if (!addr) return "-";
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

function formatPeriodLabel(weekKey: string): string {
  // Format: "2026-02-09-P1" → "Feb 9, 2026 — P1"
  const match = weekKey.match(/^(\d{4})-(\d{2})-(\d{2})-P(\d)$/);
  if (!match) return weekKey;
  const d = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`);
  const label = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${label} — Period ${match[4]}`;
}

/* ── Component ── */

type View = "periods" | "users" | "detail";

export default function XessPaymentsClient() {
  const [view, setView] = useState<View>("periods");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Periods view
  const [periods, setPeriods] = useState<Period[]>([]);

  // Users view
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [periodGrandTotal, setPeriodGrandTotal] = useState("0");
  const [periodClaimedCount, setPeriodClaimedCount] = useState(0);

  // Detail view
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [detailTotal, setDetailTotal] = useState("0");
  const [detailClaimed, setDetailClaimed] = useState(false);

  const fetchPeriods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/xess-payments", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setPeriods(data.periods);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async (weekKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/xess-payments?weekKey=${encodeURIComponent(weekKey)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setUsers(data.users);
      setPeriodGrandTotal(data.grandTotal);
      setPeriodClaimedCount(data.claimedCount);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (weekKey: string, userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/xess-payments?weekKey=${encodeURIComponent(weekKey)}&userId=${encodeURIComponent(userId)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setEvents(data.events);
      setDetailTotal(data.total);
      setDetailClaimed(data.claimed);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  function openPeriod(weekKey: string) {
    setSelectedPeriod(weekKey);
    setView("users");
    fetchUsers(weekKey);
  }

  function openDetail(user: UserRow) {
    setSelectedUser(user);
    setView("detail");
    fetchDetail(selectedPeriod, user.userId);
  }

  function goBack() {
    if (view === "detail") {
      setView("users");
      setEvents([]);
    } else if (view === "users") {
      setView("periods");
      setUsers([]);
    }
  }

  const title =
    view === "detail"
      ? `${selectedUser?.username || selectedUser?.email || selectedUser?.userId.slice(0, 12) + "..."} — ${formatPeriodLabel(selectedPeriod)}`
      : view === "users"
        ? formatPeriodLabel(selectedPeriod)
        : "XESS Token Payment History";

  return (
    <main className="min-h-screen p-6 text-white max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {view !== "periods" && (
            <button
              onClick={goBack}
              className="text-white/50 hover:text-white transition p-1"
              title="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold neon-text">{title}</h1>
            <p className="text-white/60 text-sm mt-1">
              {view === "periods" && "All twice-weekly XESS token payouts"}
              {view === "users" && "Per-user token allocation and claim status"}
              {view === "detail" && "Detailed reward breakdown by pool"}
            </p>
          </div>
        </div>
        <Link
          href="/admin/controls"
          className="px-4 py-2 rounded-full border border-white/30 bg-black/40 text-white text-sm font-semibold hover:bg-white/10 transition"
        >
          Back to Controls
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && <div className="text-red-400 text-sm text-center py-8">{error}</div>}

      {/* ── Periods View ── */}
      {!loading && !error && view === "periods" && (
        <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 bg-white/5">
            <h2 className="font-semibold text-lg">Payout Periods</h2>
            <p className="text-xs text-white/50 mt-0.5">
              {periods.length} completed payout{periods.length !== 1 ? "s" : ""}
            </p>
          </div>

          {periods.length === 0 ? (
            <div className="p-8 text-center text-white/50">No payouts yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/50 border-b border-white/10">
                    <th className="px-5 py-3 font-medium">Period</th>
                    <th className="px-5 py-3 font-medium text-right">Total XESS</th>
                    <th className="px-5 py-3 font-medium text-right">Users</th>
                    <th className="px-5 py-3 font-medium text-right">Claimed</th>
                    <th className="px-5 py-3 font-medium">Completed</th>
                    <th className="px-5 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr
                      key={p.weekKey}
                      className="border-b border-white/5 hover:bg-white/5 transition cursor-pointer"
                      onClick={() => openPeriod(p.weekKey)}
                    >
                      <td className="px-5 py-3">
                        <div className="font-medium text-white/90">{formatPeriodLabel(p.weekKey)}</div>
                        <div className="text-[10px] text-white/40 font-mono">{p.weekKey}</div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-amber-300 font-semibold">
                        {formatXess6(p.totalAmount, 0)}
                      </td>
                      <td className="px-5 py-3 text-right text-white/70">
                        {p.totalUsersWithRewards}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={
                            p.claimedUsers === p.totalUsersWithRewards && p.totalUsersWithRewards > 0
                              ? "text-green-400"
                              : p.claimedUsers > 0
                                ? "text-yellow-300"
                                : "text-white/40"
                          }
                        >
                          {p.claimedUsers}/{p.totalUsersWithRewards}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-white/50 text-xs whitespace-nowrap">
                        {p.finishedAt
                          ? new Date(p.finishedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition text-white/70">
                          View Users
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

      {/* ── Users View ── */}
      {!loading && !error && view === "users" && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl bg-black/40 border border-white/10 p-4 text-center">
              <div className="text-2xl font-bold text-amber-300 font-mono">
                {formatXess6(periodGrandTotal, 0)}
              </div>
              <div className="text-xs text-white/50">Total XESS Distributed</div>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/10 p-4 text-center">
              <div className="text-2xl font-bold text-white">{users.length}</div>
              <div className="text-xs text-white/50">Users Paid</div>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/10 p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                {periodClaimedCount}/{users.length}
              </div>
              <div className="text-xs text-white/50">Claimed</div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/50 border-b border-white/10">
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Wallet</th>
                    <th className="px-5 py-3 font-medium text-right">XESS Earned</th>
                    <th className="px-5 py-3 font-medium text-right">Rewards</th>
                    <th className="px-5 py-3 font-medium text-center">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.userId}
                      className="border-b border-white/5 hover:bg-white/5 transition cursor-pointer"
                      onClick={() => openDetail(u)}
                    >
                      <td className="px-5 py-3">
                        <div className="text-white/90 font-medium truncate max-w-[160px]">
                          {u.username || u.email || u.userId.slice(0, 12) + "..."}
                        </div>
                        <div className="text-[10px] text-white/30 font-mono">
                          {u.userId.slice(0, 16)}...
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-white/60 text-xs">
                        {shortWallet(u.walletAddress)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-amber-300 font-semibold">
                        {formatXess6(u.total, 2)}
                      </td>
                      <td className="px-5 py-3 text-right text-white/60">
                        {u.eventCount}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            u.claimed
                              ? "bg-green-500/20 text-green-300"
                              : "bg-yellow-500/20 text-yellow-300"
                          }`}
                        >
                          {u.claimed ? "Claimed" : "Unclaimed"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition text-white/70">
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Detail View ── */}
      {!loading && !error && view === "detail" && selectedUser && (
        <>
          {/* User summary */}
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 mb-6">
            <div className="flex flex-wrap items-center gap-4 justify-between">
              <div>
                <div className="text-lg font-semibold text-white">
                  {selectedUser.username || selectedUser.email || selectedUser.userId}
                </div>
                {selectedUser.walletAddress && (
                  <div className="text-xs text-white/40 font-mono mt-0.5">
                    {selectedUser.walletAddress}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xl font-bold font-mono text-amber-300">
                    {formatXess6(detailTotal, 2)} XESS
                  </div>
                  <div className="text-xs text-white/50">Total for this period</div>
                </div>
                <span
                  className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                    detailClaimed
                      ? "bg-green-500/20 text-green-300 border border-green-400/30"
                      : "bg-yellow-500/20 text-yellow-300 border border-yellow-400/30"
                  }`}
                >
                  {detailClaimed ? "Claimed" : "Unclaimed"}
                </span>
              </div>
            </div>
          </div>

          {/* Reward breakdown */}
          <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 bg-white/5">
              <h2 className="font-semibold text-lg">Reward Breakdown</h2>
              <p className="text-xs text-white/50 mt-0.5">
                {events.length} reward event{events.length !== 1 ? "s" : ""} in this period
              </p>
            </div>

            {events.length === 0 ? (
              <div className="p-8 text-center text-white/50">No reward events</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/50 border-b border-white/10">
                      <th className="px-5 py-3 font-medium">Pool / Type</th>
                      <th className="px-5 py-3 font-medium text-right">XESS Amount</th>
                      <th className="px-5 py-3 font-medium text-center">Status</th>
                      <th className="px-5 py-3 font-medium">Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-white/5 hover:bg-white/5 transition"
                      >
                        <td className="px-5 py-3">
                          <div className="text-white/90 font-medium">
                            {rewardTypeLabel(e.type, e.refType)}
                          </div>
                          <div className="text-[10px] text-white/40 font-mono">
                            {e.refType}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-amber-300 font-semibold">
                          {formatXess6(e.amount, 4)}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                              e.status === "CLAIMED"
                                ? "bg-green-500/20 text-green-300"
                                : e.status === "PAID"
                                  ? "bg-yellow-500/20 text-yellow-300"
                                  : "bg-white/10 text-white/50"
                            }`}
                          >
                            {e.status === "CLAIMED" ? "Claimed" : e.status === "PAID" ? "Unclaimed" : e.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-white/40 text-xs font-mono max-w-[200px] truncate">
                          {e.refId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
