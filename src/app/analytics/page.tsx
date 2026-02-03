"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import TopNav from "../components/TopNav";

type ContentFilter = "standard" | "xessex";

type CommentModalData = {
  body: string;
  createdAt: string;
  score: number;
  memberLikes: number;
  memberDislikes: number;
  utilized: boolean;
} | null;

type AnalyticsData = {
  contentFilter: ContentFilter;
  totals: {
    totalVideos: number;
    totalComments: number;
    totalMemberLikes: number;
    totalMemberDislikes: number;
    totalModLikes: number;
    totalModDislikes: number;
    utilizedComments: number;
    totalXessPaid: number;
    claimableXess: number;
    estimatedPendingXess: number;
  };
  currentWeek: {
    weekKey: string;
    activity: {
      scoreReceived: number;
      diamondComments: number;
      mvmPoints: number;
    };
    ranks: {
      likes: number | null;
      mvm: number | null;
      comments: number | null;
    };
    nextPayout: string;
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedComment, setSelectedComment] = useState<CommentModalData>(null);
  const [contentFilter, setContentFilter] = useState<ContentFilter>("standard");

  const fetchAnalytics = useCallback((filter: ContentFilter, isInitial: boolean) => {
    if (isInitial) {
      setInitialLoading(true);
    } else {
      setTabLoading(true);
    }
    setError(null);
    fetch(`/api/analytics?contentFilter=${filter}`)
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
      .finally(() => {
        setInitialLoading(false);
        setTabLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchAnalytics(contentFilter, !data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentFilter]);

  const handleFilterChange = (filter: ContentFilter) => {
    if (filter !== contentFilter) {
      setContentFilter(filter);
    }
  };

  if (initialLoading) {
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
              Analytics are exclusively available to authenticated users.
            </p>
            <Link
              href="/login/diamond"
              className="inline-block px-6 py-3 rounded-xl bg-yellow-500/80 hover:bg-yellow-500 text-black font-medium transition"
            >
              Connect Wallet
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

  const { totals, comments, currentWeek } = data;

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

        {/* Content Filter Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => handleFilterChange("standard")}
            disabled={tabLoading}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 ${
              contentFilter === "standard"
                ? "bg-pink-500 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Standard
          </button>
          <button
            onClick={() => handleFilterChange("xessex")}
            disabled={tabLoading}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 ${
              contentFilter === "xessex"
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Xessex Content
          </button>
          {tabLoading && (
            <div className="animate-spin w-5 h-5 border-2 border-pink-400 border-t-transparent rounded-full ml-2" />
          )}
        </div>

        {/* Content wrapper with loading fade */}
        <div className={`transition-opacity duration-200 ${tabLoading ? "opacity-50" : "opacity-100"}`}>

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="neon-border rounded-xl p-4 bg-gradient-to-r from-yellow-500/10 via-black/0 to-yellow-500/5 border-yellow-400/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-yellow-400/80 uppercase tracking-wide">
                  Total XESS Claimed
                </div>
                <div className="text-2xl font-bold text-yellow-400 mt-1">
                  {totals.totalXessPaid.toLocaleString()} XESS
                </div>
              </div>
              <div className="text-yellow-400/50 text-4xl">💰</div>
            </div>
          </div>

          <div className="neon-border rounded-xl p-4 bg-gradient-to-r from-emerald-500/10 via-black/0 to-emerald-500/5 border-emerald-400/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-emerald-400/80 uppercase tracking-wide">
                  Ready to Claim
                </div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  {totals.claimableXess.toLocaleString()} XESS
                </div>
              </div>
              <div className="text-emerald-400/50 text-4xl">✓</div>
            </div>
          </div>

          <div className="neon-border rounded-xl p-4 bg-gradient-to-r from-purple-500/10 via-black/0 to-purple-500/5 border-purple-400/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-purple-400/80 uppercase tracking-wide">
                  Est. Pending (Live)
                </div>
                <div className="text-2xl font-bold text-purple-400 mt-1">
                  ~{totals.estimatedPendingXess.toLocaleString()} XESS
                </div>
              </div>
              <div className="text-purple-400/50 text-4xl">⏳</div>
            </div>
          </div>
        </div>

        {/* Current Week Activity */}
        {currentWeek && (
          <div className="neon-border rounded-xl p-4 md:p-6 bg-black/30 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold neon-text">
                This Week&apos;s Activity
              </h2>
              <div className="text-sm text-white/50">
                Next payout: {currentWeek.nextPayout}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {currentWeek.activity.scoreReceived}
                </div>
                <div className="text-xs text-white/60 mt-1">Score Received</div>
                {currentWeek.ranks.likes && (
                  <div className="text-xs text-pink-400 mt-1">
                    Rank #{currentWeek.ranks.likes}
                  </div>
                )}
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {currentWeek.activity.diamondComments}
                </div>
                <div className="text-xs text-white/60 mt-1">Comments Posted</div>
                {currentWeek.ranks.comments && (
                  <div className="text-xs text-pink-400 mt-1">
                    Rank #{currentWeek.ranks.comments}
                  </div>
                )}
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {currentWeek.activity.mvmPoints}
                </div>
                <div className="text-xs text-white/60 mt-1">MVM Points</div>
                {currentWeek.ranks.mvm && (
                  <div className="text-xs text-pink-400 mt-1">
                    Rank #{currentWeek.ranks.mvm}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 text-xs text-white/40 text-center">
              Estimated pending updates live as you earn likes and post comments
            </div>
          </div>
        )}

        {/* Comments List */}
        <div className="neon-border rounded-2xl p-4 md:p-6 bg-black/30">
          <h2 className="text-lg font-semibold neon-text mb-4">
            Your Comments ({comments.length})
          </h2>

          {comments.length === 0 ? (
            <p className="text-white/50 text-center py-8">
              You haven&apos;t posted any comments yet.
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => {
                const openModal = () => {
                  setSelectedComment({
                    body: c.body,
                    createdAt: c.createdAt,
                    score: c.score,
                    memberLikes: c.memberLikes,
                    memberDislikes: c.memberDislikes,
                    utilized: c.utilized,
                  });
                };
                return (
                  <div
                    key={c.sourceId}
                    className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-pink-500/40 transition-colors"
                  >
                    {/* Header row with stats */}
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-mono text-xs text-white/50">#{c.sourceId.slice(-6)}</span>
                        <span className={`font-semibold ${c.score > 0 ? "text-green-400" : c.score < 0 ? "text-red-400" : "text-white/50"}`}>
                          Score: {c.score > 0 ? "+" : ""}{c.score}
                        </span>
                        <span className="text-white/60">
                          <span className="text-green-400">{c.memberLikes}</span>
                          <span className="text-white/30 mx-1">/</span>
                          <span className="text-red-400">{c.memberDislikes}</span>
                        </span>
                        {c.utilized ? (
                          <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                            MVM
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/40">
                            Pending
                          </span>
                        )}
                      </div>
                      <span className="text-white/40 text-xs">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Comment preview and View button */}
                    <div className="flex items-start gap-3">
                      <p className="flex-1 text-white/80 text-sm line-clamp-2 min-h-[2.5rem]">
                        {c.body}
                      </p>
                      <button
                        type="button"
                        onClick={openModal}
                        className="flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-lg bg-pink-500/30 text-pink-300 hover:bg-pink-500/50 border border-pink-500/50 transition-all hover:scale-105 active:scale-95"
                      >
                        View Full
                      </button>
                    </div>
                  </div>
                );
              })}
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
            <strong>Score</strong> = (+5 × member likes) + (+15 × admin/mod likes) +
            (-1 × member dislikes) + (-20 × mod dislikes)
          </p>
        </div>

        </div>{/* End content wrapper */}
      </div>

      {/* Comment Modal */}
      {selectedComment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setSelectedComment(null)}
        >
          <div
            className="bg-black/95 border border-pink-500/40 rounded-2xl p-6 max-w-lg w-full shadow-[0_0_30px_rgba(236,72,153,0.3)] max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Comment Details</h3>
              <button
                onClick={() => setSelectedComment(null)}
                className="text-white/60 hover:text-white transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Comment Body */}
              <div>
                <div className="text-xs text-white/50 mb-1">Comment</div>
                <div className="text-white/90 whitespace-pre-wrap break-words bg-white/5 rounded-lg p-3">
                  {selectedComment.body}
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className={`text-xl font-bold ${
                    selectedComment.score > 0 ? "text-green-400" :
                    selectedComment.score < 0 ? "text-red-400" : "text-white/50"
                  }`}>
                    {selectedComment.score > 0 ? "+" : ""}{selectedComment.score}
                  </div>
                  <div className="text-xs text-white/50 mt-1">Score</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold">
                    <span className="text-green-400">{selectedComment.memberLikes}</span>
                    <span className="text-white/30 mx-1">/</span>
                    <span className="text-red-400">{selectedComment.memberDislikes}</span>
                  </div>
                  <div className="text-xs text-white/50 mt-1">Likes/Dislikes</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  {selectedComment.utilized ? (
                    <div className="text-xl font-bold text-green-400">MVM</div>
                  ) : (
                    <div className="text-xl font-bold text-white/40">Pending</div>
                  )}
                  <div className="text-xs text-white/50 mt-1">Status</div>
                </div>
              </div>

              {/* Date */}
              <div className="text-sm text-white/50">
                Posted on {new Date(selectedComment.createdAt).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>

            <button
              onClick={() => setSelectedComment(null)}
              className="w-full mt-6 py-3 px-6 rounded-xl font-semibold text-white/70 transition bg-white/10 border border-white/20 hover:bg-white/20"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
