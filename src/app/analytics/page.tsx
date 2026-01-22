"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TopNav from "../components/TopNav";

type AnalyticsData = {
  totals: {
    totalVideos: number;
    totalComments: number;
    totalMemberLikes: number;
    totalMemberDislikes: number;
    totalModLikes: number;
    totalModDislikes: number;
    utilizedComments: number;
    totalXessPaid: number;
    pendingXess: number;
  };
  comments: {
    sourceId: string;
    createdAt: string;
    body: string;
    memberLikes: number;
    memberDislikes: number;
    modLikes: number;
    modDislikes: number;
    utilized: boolean;
    score: number;
  }[];
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => {
        if (res.status === 401) throw new Error("UNAUTHORIZED");
        if (res.status === 403) throw new Error("DIAMOND_ONLY");
        return res.json();
      })
      .then((d) => {
        if (d.ok) {
          setData(d);
        } else {
          throw new Error(d.error || "Failed to load analytics");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen">
        <TopNav />
        <div className="px-4 md:px-6 pb-10">
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-white/60">Loading analytics...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error === "UNAUTHORIZED") {
    return (
      <main className="min-h-screen">
        <TopNav />
        <div className="px-4 md:px-6 pb-10">
          <div className="neon-border rounded-2xl p-8 bg-black/30 text-center mt-8">
            <h2 className="text-2xl font-bold text-white mb-4">
              Login Required
            </h2>
            <p className="text-white/70 mb-6">
              Please log in to view your analytics.
            </p>
            <Link
              href="/login"
              className="inline-block px-6 py-3 rounded-xl bg-pink-500/80 hover:bg-pink-500 text-white font-medium transition"
            >
              Log In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (error === "DIAMOND_ONLY") {
    return (
      <main className="min-h-screen">
        <TopNav />
        <div className="px-4 md:px-6 pb-10">
          <div className="neon-border rounded-2xl p-8 bg-gradient-to-r from-yellow-500/10 via-black/0 to-yellow-500/10 text-center mt-8 border-yellow-400/30">
            <h2 className="text-2xl font-bold text-yellow-400 mb-4">
              Diamond Members Only
            </h2>
            <p className="text-white/70 mb-6">
              Analytics are exclusively available to Diamond Members.
            </p>
            <Link
              href="/signup"
              className="inline-block px-6 py-3 rounded-xl bg-yellow-500/80 hover:bg-yellow-500 text-black font-medium transition"
            >
              Become a Diamond Member
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen">
        <TopNav />
        <div className="px-4 md:px-6 pb-10">
          <div className="neon-border rounded-2xl p-8 bg-black/30 text-center mt-8">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
            <p className="text-white/70">{error || "Failed to load analytics"}</p>
          </div>
        </div>
      </main>
    );
  }

  const { totals, comments } = data;

  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-4 md:px-6 pb-10">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold neon-text">
            Your Analytics
          </h1>
          <p className="text-white/60 mt-1">
            Diamond Member performance dashboard
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="neon-border rounded-xl p-4 bg-black/30">
            <div className="text-2xl md:text-3xl font-bold text-white">
              {totals.totalComments}
            </div>
            <div className="text-xs md:text-sm text-white/60 mt-1">
              Total Comments
            </div>
          </div>

          <div className="neon-border rounded-xl p-4 bg-black/30 border-green-400/30">
            <div className="text-2xl md:text-3xl font-bold text-green-400">
              {totals.utilizedComments}
            </div>
            <div className="text-xs md:text-sm text-white/60 mt-1">
              Utilized (MVM)
            </div>
          </div>

          <div className="neon-border rounded-xl p-4 bg-black/30">
            <div className="text-2xl md:text-3xl font-bold text-white">
              {totals.totalMemberLikes}
            </div>
            <div className="text-xs md:text-sm text-white/60 mt-1">
              Member Likes
            </div>
          </div>

          <div className="neon-border rounded-xl p-4 bg-black/30">
            <div className="text-2xl md:text-3xl font-bold text-white">
              {totals.totalModLikes}
            </div>
            <div className="text-xs md:text-sm text-white/60 mt-1">Mod Likes</div>
          </div>
        </div>

        {/* Rewards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="neon-border rounded-xl p-4 bg-gradient-to-r from-yellow-500/10 via-black/0 to-yellow-500/5 border-yellow-400/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-yellow-400/80 uppercase tracking-wide">
                  Total XESS Paid
                </div>
                <div className="text-2xl font-bold text-yellow-400 mt-1">
                  {totals.totalXessPaid.toLocaleString()} XESS
                </div>
              </div>
              <div className="text-yellow-400/50 text-4xl">💰</div>
            </div>
          </div>

          <div className="neon-border rounded-xl p-4 bg-gradient-to-r from-green-500/10 via-black/0 to-green-500/5 border-green-400/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-green-400/80 uppercase tracking-wide">
                  Pending XESS
                </div>
                <div className="text-2xl font-bold text-green-400 mt-1">
                  {totals.pendingXess.toLocaleString()} XESS
                </div>
              </div>
              <div className="text-green-400/50 text-4xl">⏳</div>
            </div>
          </div>
        </div>

        {/* Comments Table */}
        <div className="neon-border rounded-2xl p-4 md:p-6 bg-black/30">
          <h2 className="text-lg font-semibold neon-text mb-4">
            Your Comments ({comments.length})
          </h2>

          {comments.length === 0 ? (
            <p className="text-white/50 text-center py-8">
              You haven't posted any comments yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/50 border-b border-white/10">
                    <th className="pb-3 font-medium">Source ID</th>
                    <th className="pb-3 font-medium">Comment</th>
                    <th className="pb-3 font-medium text-center">Score</th>
                    <th className="pb-3 font-medium text-center">Likes</th>
                    <th className="pb-3 font-medium text-center">Status</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {comments.map((c) => (
                    <tr
                      key={c.sourceId}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="py-3 font-mono text-xs text-white/60">
                        #{c.sourceId.slice(-6)}
                      </td>
                      <td className="py-3 max-w-xs truncate text-white/80">
                        {c.body}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`font-semibold ${
                            c.score > 0
                              ? "text-green-400"
                              : c.score < 0
                              ? "text-red-400"
                              : "text-white/50"
                          }`}
                        >
                          {c.score > 0 ? "+" : ""}
                          {c.score}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className="text-green-400">{c.memberLikes}</span>
                        <span className="text-white/30 mx-1">/</span>
                        <span className="text-red-400">{c.memberDislikes}</span>
                      </td>
                      <td className="py-3 text-center">
                        {c.utilized ? (
                          <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                            MVM
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/40">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-white/50 text-xs">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 text-xs text-white/40">
          <p>
            <strong>MVM</strong> = Most Valuable Member - your comment was used
            to adjust a video's score
          </p>
          <p className="mt-1">
            <strong>Score</strong> = (+5 × member likes) + (+35 × mod likes) +
            (-1 × member dislikes) + (-20 × mod dislikes)
          </p>
        </div>
      </div>
    </main>
  );
}
