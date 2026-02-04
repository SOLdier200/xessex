"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Reporter = {
  id: string;
  email: string | null;
  walletAddress: string | null;
  reportedAt: string;
  reason: string;
};

type ReportRow = {
  commentId: string;
  body: string;
  createdAt: string;
  status: string;
  author: { id: string; email: string | null; walletAddress: string | null; createdAt?: string };
  video: { id: string; slug: string; title: string };
  reportCount: number;
  reasons: Record<string, number>;
  reporters: Reporter[];
  latestReportAt: string;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function truncate(s: string, max = 120) {
  if (s.length <= max) return s;
  return s.slice(0, max).trim() + "…";
}

function formatWallet(wallet: string | null) {
  if (!wallet) return null;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function getUserDisplay(user: { email: string | null; walletAddress: string | null; id: string }) {
  if (user.email) return user.email;
  if (user.walletAddress) return formatWallet(user.walletAddress);
  return user.id.slice(0, 8) + "...";
}

export default function ReportedCommentsPanel() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mod/comment-reports", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Failed to load reports");
      }
      setReports(data.reports || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const dismissReports = async (commentId: string) => {
    setActionId(commentId);
    setError(null);
    try {
      const res = await fetch("/api/mod/comment-reports/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Failed to resolve");
      }
      setReports((prev) => prev.filter((r) => r.commentId !== commentId));
    } catch (e: any) {
      setError(e?.message || "Failed to resolve");
    } finally {
      setActionId(null);
    }
  };

  const removeComment = async (commentId: string) => {
    setActionId(commentId);
    setError(null);
    try {
      const res = await fetch("/api/mod/comments/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, reason: "reported" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Failed to remove comment");
      }
      await dismissReports(commentId);
    } catch (e: any) {
      setError(e?.message || "Failed to remove comment");
      setActionId(null);
    }
  };

  return (
    <div className="bg-gray-900 border border-red-500/30 rounded-xl mb-8">
      <div className="p-6 border-b border-red-500/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-red-300">Reported Comments</h2>
            <p className="text-sm text-gray-400">Review user reports and take action</p>
          </div>
          <button
            onClick={fetchReports}
            disabled={loading}
            className="px-3 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition text-sm"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        {error && (
          <div className="mt-3 text-sm text-red-400">{error}</div>
        )}
      </div>
      <div className="p-6">
        {loading ? (
          <div className="text-center text-gray-400 py-6">Loading reports…</div>
        ) : reports.length === 0 ? (
          <div className="text-center text-gray-500 py-6">No reported comments</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="pb-3 font-medium w-8"></th>
                  <th className="pb-3 font-medium">Comment</th>
                  <th className="pb-3 font-medium">Author Info</th>
                  <th className="pb-3 font-medium">Video</th>
                  <th className="pb-3 font-medium">Reports</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {reports.map((r) => (
                  <Fragment key={r.commentId}>
                    <tr className="hover:bg-gray-800/50">
                      <td className="py-3 pr-2">
                        <button
                          onClick={() => setExpandedId(expandedId === r.commentId ? null : r.commentId)}
                          className="text-gray-400 hover:text-white transition"
                        >
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedId === r.commentId ? "rotate-90" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="text-white/90">{truncate(r.body)}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          <span className={r.status === "REMOVED" ? "text-red-400" : "text-green-400"}>
                            {r.status === "REMOVED" ? "REMOVED" : "ACTIVE"}
                          </span>
                          {" • "}{formatDate(r.createdAt)}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="space-y-1">
                          <div className="text-white/90 font-medium">{getUserDisplay(r.author)}</div>
                          {r.author.walletAddress && (
                            <div className="text-xs text-cyan-400 font-mono">
                              {formatWallet(r.author.walletAddress)}
                            </div>
                          )}
                          {r.author.email && r.author.walletAddress && (
                            <div className="text-xs text-gray-500">+ wallet linked</div>
                          )}
                          <div className="text-xs text-gray-500">
                            ID: {r.author.id.slice(0, 8)}...
                          </div>
                          {r.author.createdAt && (
                            <div className="text-xs text-gray-600">
                              Joined: {formatDate(r.author.createdAt)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/videos/${r.video.slug}`}
                          className="text-cyan-300 hover:text-cyan-200"
                        >
                          {truncate(r.video.title || r.video.slug, 32)}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="text-white/90 font-semibold text-lg">{r.reportCount}</div>
                        <div className="text-xs text-gray-500">
                          {Object.entries(r.reasons)
                            .map(([k, v]) => `${k}:${v}`)
                            .join(" • ")}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Latest: {formatDate(r.latestReportAt)}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => removeComment(r.commentId)}
                            disabled={actionId === r.commentId}
                            className="px-3 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs font-semibold disabled:opacity-50"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => dismissReports(r.commentId)}
                            disabled={actionId === r.commentId}
                            className="px-3 py-1 rounded bg-gray-700/40 text-gray-200 hover:bg-gray-700/70 text-xs font-semibold disabled:opacity-50"
                          >
                            Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === r.commentId && (
                      <tr key={`${r.commentId}-expanded`} className="bg-gray-800/30">
                        <td colSpan={6} className="py-4 px-6">
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-yellow-400">Reporters ({r.reporters.length})</h4>
                            <div className="grid gap-2">
                              {r.reporters.map((reporter, idx) => (
                                <div key={idx} className="flex items-center gap-4 p-3 bg-gray-900/50 rounded-lg text-sm">
                                  <div className="flex-1">
                                    <div className="text-white/90 font-medium">{getUserDisplay(reporter)}</div>
                                    {reporter.walletAddress && (
                                      <div className="text-xs text-cyan-400 font-mono mt-0.5">
                                        {reporter.walletAddress}
                                      </div>
                                    )}
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      ID: {reporter.id.slice(0, 12)}...
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs">
                                      {reporter.reason}
                                    </span>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {formatDate(reporter.reportedAt)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
