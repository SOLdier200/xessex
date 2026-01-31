"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ModAction {
  id: string;
  modId: string;
  modDisplay: string;
  modRole: string;
  targetUserId: string;
  targetUserDisplay: string;
  actionType: string;
  actionSubtype: string | null;
  reason: string | null;
  details: {
    targetType?: string;
    duration?: string;
    expiresAt?: string;
  } | null;
  createdAt: string;
}

interface Moderator {
  id: string;
  display: string;
  role: string;
  actionCount: number;
}

export default function AdminModActionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [actions, setActions] = useState<ModAction[]>([]);
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [total, setTotal] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);

  // Filter state
  const [selectedMod, setSelectedMod] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json();

        if (!data.ok || !data.authed || data.user?.role !== "ADMIN") {
          router.push("/");
          return;
        }
      } catch (err) {
        setError("Failed to verify access");
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [router]);

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (selectedMod) {
        params.set("modId", selectedMod);
      }

      const res = await fetch(`/api/admin/mod-actions?${params}`, { credentials: "include" });
      const data = await res.json();

      if (data.ok) {
        setActions(data.actions || []);
        setModerators(data.moderators || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setDataLoading(false);
    }
  }, [selectedMod, offset]);

  useEffect(() => {
    if (!loading && !error) {
      fetchData();
    }
  }, [loading, error, fetchData]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionBadge = (actionType: string) => {
    if (actionType.includes("_BAN")) {
      return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">{actionType}</span>;
    }
    if (actionType.includes("_UNBAN")) {
      return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">{actionType}</span>;
    }
    return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">{actionType}</span>;
  };

  const getDurationLabel = (subtype: string | null) => {
    if (!subtype) return "-";
    switch (subtype) {
      case "1_week":
        return "1 Week";
      case "2_week":
        return "2 Weeks";
      case "4_week":
        return "4 Weeks";
      case "permanent":
        return "Permanent";
      default:
        return subtype;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-pink-500 text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-red-500 text-xl">{error}</div>
        <Link href="/admin/controls" className="text-pink-500 hover:text-pink-400 underline">
          Back to Admin
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold neon-text">Mod Actions Audit</h1>
          <p className="text-white/60 text-sm mt-1">Review all moderator actions</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            disabled={dataLoading}
            className="px-4 py-2 rounded-full border border-pink-400/50 bg-pink-500/20 text-white text-sm font-semibold hover:bg-pink-500/30 transition disabled:opacity-50"
          >
            {dataLoading ? "Loading..." : "Refresh"}
          </button>
          <Link
            href="/admin/controls"
            className="px-4 py-2 rounded-full border border-white/30 bg-black/40 text-white text-sm font-semibold hover:bg-white/10 transition"
          >
            Back to Admin
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="neon-border rounded-xl p-4 bg-black/30">
          <div className="text-indigo-400 text-3xl font-bold">{total}</div>
          <div className="text-white/60 text-sm">Total Actions</div>
        </div>
        <div className="neon-border rounded-xl p-4 bg-black/30">
          <div className="text-purple-400 text-3xl font-bold">{moderators.length}</div>
          <div className="text-white/60 text-sm">Active Moderators</div>
        </div>
        <div className="neon-border rounded-xl p-4 bg-black/30 col-span-2">
          <div className="text-white/60 text-sm mb-2">Top Moderator Actions</div>
          <div className="flex gap-4 flex-wrap">
            {moderators
              .sort((a, b) => b.actionCount - a.actionCount)
              .slice(0, 3)
              .map((m) => (
                <div key={m.id} className="text-sm">
                  <span className="text-white">{m.display}</span>
                  <span className="text-white/40 ml-2">({m.actionCount})</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="neon-border rounded-xl p-4 bg-black/30 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="text-white/60 text-sm block mb-1">Filter by Moderator</label>
            <select
              value={selectedMod}
              onChange={(e) => {
                setSelectedMod(e.target.value);
                setOffset(0);
              }}
              className="px-4 py-2 bg-black/50 border border-white/20 rounded-lg text-white"
            >
              <option value="">All Moderators</option>
              {moderators.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display} ({m.actionCount} actions)
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1" />
          <div className="text-white/60 text-sm">
            Showing {offset + 1} - {Math.min(offset + limit, total)} of {total}
          </div>
        </div>
      </div>

      {/* Actions Table */}
      <div className="neon-border rounded-2xl bg-black/30">
        <div className="p-4 border-b border-indigo-500/30">
          <h2 className="text-xl font-bold text-indigo-400">Action Log</h2>
        </div>
        <div className="p-4">
          {actions.length === 0 ? (
            <div className="text-center text-white/40 py-8">No actions found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-white/60 text-sm">
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Moderator</th>
                    <th className="pb-3">Target User</th>
                    <th className="pb-3">Action</th>
                    <th className="pb-3">Duration</th>
                    <th className="pb-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {actions.map((a) => (
                    <tr key={a.id} className="hover:bg-white/5">
                      <td className="py-3 text-white/60 text-sm whitespace-nowrap">
                        {formatDate(a.createdAt)}
                      </td>
                      <td className="py-3">
                        <div className="text-white">{a.modDisplay}</div>
                        <div className="text-white/40 text-xs">{a.modRole}</div>
                      </td>
                      <td className="py-3">
                        <div className="text-white">{a.targetUserDisplay}</div>
                        <div className="text-white/40 text-xs">{a.targetUserId.slice(0, 12)}...</div>
                      </td>
                      <td className="py-3">{getActionBadge(a.actionType)}</td>
                      <td className="py-3 text-white/60 text-sm">
                        {getDurationLabel(a.actionSubtype)}
                      </td>
                      <td className="py-3 text-white/60 text-sm max-w-xs truncate">
                        {a.reason || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="flex justify-center gap-4 mt-6">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-4 py-2 rounded-lg border border-white/20 bg-black/50 text-white disabled:opacity-30"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-4 py-2 rounded-lg border border-white/20 bg-black/50 text-white disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
