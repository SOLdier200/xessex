"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";

type Video = {
  id: number;
  viewkey: string;
  title: string | null;
  primary_thumb: string | null;
  duration: number | null;
  views: number | null;
  embed_html: string | null;
  tags: string | null;
  categories: string | null;
  performers: string | null;
  status: string;
  note: string | null;
  favorite: number;
};

type Cursor = { value: number; viewkey: string } | null;
type DbSource = "embeds" | "youporn";

type ApiResponse = {
  videos: Video[];
  nextCursor: Cursor;
  hasMore: boolean;
  stats: { approved: number };
};

type PendingComment = {
  id: string;
  body: string;
  createdAt: string;
  autoReason: string | null;
  status: "PENDING" | "HIDDEN";
  reportCount: number;
  reportReasonCounts: Record<string, number>;
  latestReportAt: string | null;
  author: { id: string; email: string | null; walletAddress: string | null };
  video: { id: string; slug: string; title: string; kind: string };
};

export default function ReviewApprovedPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [approvedCount, setApprovedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Database source
  const [dbSource, setDbSource] = useState<DbSource>("embeds");

  // Cursor-based pagination
  const [cursorStack, setCursorStack] = useState<Cursor[]>([null]);
  const [nextCursor, setNextCursor] = useState<Cursor>(null);
  const [hasMore, setHasMore] = useState(false);

  // Modal state
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  // Comment review state
  const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [commentQueueStatus, setCommentQueueStatus] = useState<"ALL" | "PENDING" | "HIDDEN">("ALL");
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState<string>("");

  // Get correct embed URL based on database source
  const getEmbedUrl = (viewkey: string) => {
    if (dbSource === "youporn") {
      return `https://www.youporn.com/embed/${viewkey}`;
    }
    return `https://www.pornhub.com/embed/${viewkey}`;
  };

  const fetchVideos = useCallback(async (cursor: Cursor = null, resetStack = false) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("source", dbSource);
    params.set("status", "approved");
    if (search) params.set("search", search);
    if (cursor) {
      params.set("cursorValue", String(cursor.value));
      params.set("cursorViewkey", cursor.viewkey);
    }

    const res = await fetch(`/api/admin/videos?${params}`);
    const data: ApiResponse = await res.json();

    setVideos(data.videos);
    setNextCursor(data.nextCursor);
    setHasMore(data.hasMore);
    setApprovedCount(data.stats.approved);

    if (resetStack) {
      setCursorStack([null]);
    }

    setLoading(false);
  }, [dbSource, search]);

  const fetchPendingComments = useCallback(async () => {
    setPendingLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", commentQueueStatus);
      params.set("limit", "200");

      const res = await fetch(`/api/mod/comments/pending?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);
      if (data?.ok) {
        const rows: PendingComment[] = data.comments || [];
        setPendingComments(rows);
        setSelectedCommentId((prev) => prev ?? (rows[0]?.id ?? null));
      }
    } catch {
      // ignore
    } finally {
      setPendingLoading(false);
    }
  }, [commentQueueStatus]);

  useEffect(() => {
    fetchVideos(null, true);
  }, [fetchVideos]);

  useEffect(() => {
    fetchPendingComments();
  }, [fetchPendingComments]);

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const goNext = () => {
    if (nextCursor) {
      setCursorStack((prev) => [...prev, nextCursor]);
      fetchVideos(nextCursor);
    }
  };

  const goPrev = () => {
    if (cursorStack.length > 1) {
      const newStack = [...cursorStack];
      newStack.pop();
      const prevCursor = newStack[newStack.length - 1];
      setCursorStack(newStack);
      fetchVideos(prevCursor);
    }
  };

  const updateVideo = async (viewkey: string, patch: { status?: string; note?: string; favorite?: boolean }) => {
    await fetch(`/api/admin/videos/${viewkey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, source: dbSource }),
    });

    const currentCursor = cursorStack[cursorStack.length - 1];
    await fetchVideos(currentCursor);

    if (patch.status && patch.status !== "approved") {
      setSelectedVideo(null);
    }
  };

  const approveComment = async (commentId: string) => {
    try {
      const res = await fetch("/api/mod/comments/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || "Failed to approve");
        return;
      }
      const credits = typeof data.creditsAwarded === "number" ? data.creditsAwarded : 0;
      toast.success(credits ? `Comment approved (+${credits} credits)` : "Comment approved");

      setPendingComments((prev) => {
        const next = prev.filter((c) => c.id !== commentId);
        if (selectedCommentId === commentId) {
          setSelectedCommentId(next[0]?.id ?? null);
        }
        return next;
      });
    } catch {
      toast.error("Failed to approve");
    }
  };

  const removeComment = async (commentId: string) => {
    try {
      const res = await fetch("/api/mod/comments/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, reason: removeReason || "Removed by moderator" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || "Failed to remove");
        return;
      }
      toast.success("Comment removed");
      setRemoveReason("");

      setPendingComments((prev) => {
        const next = prev.filter((c) => c.id !== commentId);
        if (selectedCommentId === commentId) {
          setSelectedCommentId(next[0]?.id ?? null);
        }
        return next;
      });
    } catch {
      toast.error("Failed to remove");
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatViews = (views: number | null) => {
    if (!views) return "--";
    if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
    if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
    return views.toString();
  };

  const publishApprovedToLive = async () => {
    setPublishing(true);
    const toastId = toast.loading("Publishing Pimp Daddy..uno momento");
    try {
      const res = await fetch("/api/admin/publish", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        toast.success("Great Work Soldier, you did the dirty work noone wants to do.", { id: toastId });
      } else {
        toast.error(data?.error || "Publish failed", { id: toastId });
      }
    } catch {
      toast.error("Publish failed - network error", { id: toastId });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <main className="min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400">Review Approved Videos</h1>
          <p className="text-white/60 text-sm mt-1">
            {approvedCount.toLocaleString()} approved videos
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={publishApprovedToLive}
            disabled={publishing || approvedCount === 0}
            className="px-4 py-2 rounded-full border border-emerald-400/50 bg-emerald-500/20 text-white text-sm font-semibold hover:bg-emerald-500/30 transition disabled:opacity-50"
          >
            {publishing ? "Publishing..." : `Publish Approved → Live (${approvedCount})`}
          </button>
          <Link
            href="/admin"
            className="px-4 py-2 rounded-full border border-pink-400/50 bg-pink-500/20 text-white text-sm font-semibold hover:bg-pink-500/30 transition"
          >
            Back to Admin
          </Link>
        </div>
      </div>

      {/* Pending Comments Queue */}
      <div className="mb-8 rounded-2xl border border-yellow-500/30 bg-black/30 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-yellow-300">Comment Review Queue</h2>
            <p className="text-xs text-white/50">Approve or remove comments held for review</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCommentQueueStatus("ALL")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                  commentQueueStatus === "ALL"
                    ? "bg-yellow-500/20 text-yellow-200 border-yellow-400/40"
                    : "bg-black/20 text-white/60 border-white/15 hover:border-white/30"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setCommentQueueStatus("PENDING")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                  commentQueueStatus === "PENDING"
                    ? "bg-yellow-500/20 text-yellow-200 border-yellow-400/40"
                    : "bg-black/20 text-white/60 border-white/15 hover:border-white/30"
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setCommentQueueStatus("HIDDEN")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                  commentQueueStatus === "HIDDEN"
                    ? "bg-yellow-500/20 text-yellow-200 border-yellow-400/40"
                    : "bg-black/20 text-white/60 border-white/15 hover:border-white/30"
                }`}
              >
                Hidden
              </button>
            </div>

            <button
              onClick={fetchPendingComments}
              disabled={pendingLoading}
              className="px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-200 border border-yellow-400/40 text-xs font-semibold hover:bg-yellow-500/30 transition disabled:opacity-50"
            >
              {pendingLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {pendingLoading ? (
          <div className="text-center text-white/50 py-6">Loading queue…</div>
        ) : pendingComments.length === 0 ? (
          <div className="text-center text-white/40 py-6">No comments in queue</div>
        ) : (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
            {/* Left: list */}
            <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
              <div className="max-h-[420px] overflow-y-auto">
                {pendingComments.map((c) => {
                  const isSelected = c.id === selectedCommentId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCommentId(c.id)}
                      className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition ${
                        isSelected ? "bg-white/5" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] text-white/40">
                          {new Date(c.createdAt).toLocaleString()}
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full border ${
                              c.status === "PENDING"
                                ? "border-yellow-400/40 text-yellow-200 bg-yellow-500/10"
                                : "border-red-400/40 text-red-200 bg-red-500/10"
                            }`}
                          >
                            {c.status}
                          </span>

                          {c.reportCount > 0 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-white/70">
                              {c.reportCount} reports
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-1 text-sm text-white/90">
                        {c.body.length > 160 ? c.body.slice(0, 160) + "…" : c.body}
                      </div>

                      <div className="mt-1 text-[11px] text-white/50">
                        {c.author.email || c.author.walletAddress || c.author.id.slice(0, 8) + "..."} •{" "}
                        {c.video.title || c.video.slug}
                      </div>

                      <div className="mt-1 text-[11px] text-white/40">
                        {c.autoReason ? `Auto: ${c.autoReason}` : "Auto: —"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: detail */}
            {(() => {
              const selected =
                pendingComments.find((x) => x.id === selectedCommentId) || pendingComments[0];
              if (!selected) return null;

              return (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Details</div>
                      <div className="text-xs text-white/50 mt-1">
                        {selected.author.email ||
                          selected.author.walletAddress ||
                          selected.author.id.slice(0, 8) + "..."}{" "}
                        • {new Date(selected.createdAt).toLocaleString()}
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        Video:{" "}
                        <Link href={`/videos/${selected.video.slug}`} className="text-cyan-300 hover:text-cyan-200">
                          {selected.video.title || selected.video.slug}
                        </Link>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => approveComment(selected.id)}
                        className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 text-xs font-semibold hover:bg-emerald-500/30 transition"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => removeComment(selected.id)}
                        className="px-3 py-1 rounded-lg bg-red-500/20 text-red-200 border border-red-400/40 text-xs font-semibold hover:bg-red-500/30 transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
                    <div className="text-[11px] text-white/50">Comment</div>
                    <div className="mt-2 text-sm text-white/90 whitespace-pre-wrap">{selected.body}</div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                      <div className="text-[11px] text-white/50">Unresolved reports</div>
                      <div className="mt-2 text-sm text-white/80">
                        {selected.reportCount === 0 ? (
                          <span className="text-white/50">None</span>
                        ) : (
                          <div className="space-y-1">
                            {Object.entries(selected.reportReasonCounts || {}).map(([k, v]) => (
                              <div key={k} className="flex items-center justify-between">
                                <span className="text-white/70">{k}</span>
                                <span className="text-white/70">{v}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {selected.latestReportAt && (
                        <div className="mt-2 text-[11px] text-white/40">
                          Latest: {new Date(selected.latestReportAt).toLocaleString()}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                      <div className="text-[11px] text-white/50">Remove reason</div>
                      <textarea
                        value={removeReason}
                        onChange={(e) => setRemoveReason(e.target.value)}
                        rows={5}
                        placeholder='Example: "Threat of violence"'
                        className="mt-2 w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none"
                      />
                      <div className="mt-2 text-[11px] text-white/40">
                        Stored in <span className="text-white/60">removedReason</span>.
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] text-white/40">
                    Status: <span className="text-white/70">{selected.status}</span>
                    {selected.autoReason ? (
                      <>
                        {" "}
                        • Auto: <span className="text-white/70">{selected.autoReason}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Database Switcher */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setDbSource("embeds")}
          className={`px-6 py-3 rounded-xl font-bold text-lg transition ${
            dbSource === "embeds"
              ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg shadow-pink-500/30"
              : "bg-black/40 text-white/60 border border-white/20 hover:border-white/40"
          }`}
        >
          PH Embeds DB
        </button>
        <button
          onClick={() => setDbSource("youporn")}
          className={`px-6 py-3 rounded-xl font-bold text-lg transition ${
            dbSource === "youporn"
              ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30"
              : "bg-black/40 text-white/60 border border-white/20 hover:border-white/40"
          }`}
        >
          YouP DB
        </button>
      </div>

      {/* Search */}
      <div className="neon-border rounded-xl p-4 bg-black/30 mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search approved videos..."
            className="flex-1 rounded-xl bg-black/40 neon-border px-3 py-2 text-white placeholder:text-white/40"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 rounded-xl bg-emerald-500/30 text-emerald-300 border border-emerald-400 font-semibold hover:bg-emerald-500/40 transition"
          >
            Search
          </button>
        </div>
      </div>

      {/* Video Grid */}
      {loading ? (
        <div className="text-center py-12 text-white/60">Loading...</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 text-white/60">No approved videos found</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {videos.map((video) => (
              <div
                key={video.viewkey}
                className="rounded-xl bg-black/30 overflow-hidden group relative border border-emerald-400/30"
              >
                {/* Thumbnail */}
                <div
                  onClick={() => setSelectedVideo(video)}
                  className="aspect-video bg-black/60 cursor-pointer relative overflow-hidden"
                >
                  {video.primary_thumb ? (
                    <img
                      src={video.primary_thumb}
                      alt={video.title || ""}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">
                      No Thumbnail
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs text-white">
                    {formatDuration(video.duration)}
                  </div>
                  {video.favorite === 1 && (
                    <div className="absolute top-2 left-2 bg-yellow-500/80 px-2 py-0.5 rounded text-xs text-black font-semibold">
                      ★
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <div
                    onClick={() => setSelectedVideo(video)}
                    className="font-semibold text-sm text-white line-clamp-2 cursor-pointer hover:text-emerald-300 transition"
                  >
                    {video.title || "(no title)"}
                  </div>
                  <div className="mt-1 text-xs text-white/50">{formatViews(video.views)} views</div>

                  {/* Quick Actions - Move out of approved */}
                  <div className="mt-2 flex gap-1">
                    <button
                      onClick={() => updateVideo(video.viewkey, { status: "pending" })}
                      title="Move to Pending"
                      className="flex-1 px-2 py-1 rounded text-xs font-semibold bg-white/10 text-white/70 border border-white/20 hover:bg-white/20 transition"
                    >
                      Pending
                    </button>
                    <button
                      onClick={() => updateVideo(video.viewkey, { status: "rejected" })}
                      title="Reject"
                      className="flex-1 px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-300 border border-red-400/30 hover:bg-red-500/30 transition"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => updateVideo(video.viewkey, { favorite: video.favorite !== 1 })}
                      title="Favorite"
                      className={`px-2 py-1 rounded text-xs font-semibold transition ${
                        video.favorite === 1
                          ? "bg-yellow-500/30 text-yellow-300 border border-yellow-400"
                          : "bg-black/40 text-white/50 border border-white/20 hover:border-yellow-400/50"
                      }`}
                    >
                      ★
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={goPrev}
              disabled={cursorStack.length <= 1}
              className="px-4 py-2 rounded-xl border border-white/30 bg-black/40 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:border-emerald-400/50 transition"
            >
              Previous
            </button>
            <span className="text-white/60 text-sm">
              Page {cursorStack.length} {hasMore ? "" : "(last)"}
            </span>
            <button
              onClick={goNext}
              disabled={!hasMore}
              className="px-4 py-2 rounded-xl border border-white/30 bg-black/40 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:border-emerald-400/50 transition"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Video Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 bg-black/80 z-50 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && setSelectedVideo(null)}
        >
          <div className="min-h-full flex items-start sm:items-center justify-center px-4 py-6">
            <div className="bg-[#0a0f1e] neon-border rounded-2xl max-w-5xl w-full my-auto">
              {/* Modal Header */}
              <div className="p-4 border-b border-emerald-400/30 flex items-start justify-between sticky top-0 bg-[#0a0f1e] z-10 rounded-t-2xl">
                <div className="flex-1 min-w-0 pr-4">
                  <h2 className="text-xl font-bold text-white truncate">{selectedVideo.title}</h2>
                  <div className="mt-1 text-sm text-white/60">
                    viewkey: {selectedVideo.viewkey}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={getEmbedUrl(selectedVideo.viewkey)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 text-sm font-semibold hover:bg-emerald-500/30 transition"
                    title="Open in new tab (fullscreen)"
                  >
                    Open Full ↗
                  </a>
                  <button
                    onClick={() => setSelectedVideo(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white/60 hover:text-white hover:bg-white/20 text-xl leading-none transition"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Video Embed */}
              <div className="p-4">
                <div className="bg-black rounded-xl overflow-hidden aspect-video">
                  <iframe
                    src={getEmbedUrl(selectedVideo.viewkey)}
                    frameBorder={0}
                    width="100%"
                    height="100%"
                    allowFullScreen
                    allow="fullscreen"
                    style={{ minHeight: "400px" }}
                  />
                </div>
              </div>

              {/* Details */}
              <div className="p-4 border-t border-emerald-400/30 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-white/50">Duration:</span>{" "}
                  <span className="text-white">{formatDuration(selectedVideo.duration)}</span>
                </div>
                <div>
                  <span className="text-white/50">Views:</span>{" "}
                  <span className="text-white">{selectedVideo.views?.toLocaleString() || "--"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-white/50">Performers:</span>{" "}
                  <span className="text-white">{selectedVideo.performers || "N/A"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-white/50">Categories:</span>{" "}
                  <span className="text-white">{selectedVideo.categories || "N/A"}</span>
                </div>
                {selectedVideo.note && (
                  <div className="col-span-2">
                    <span className="text-white/50">Note:</span>{" "}
                    <span className="text-white">{selectedVideo.note}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-emerald-400/30 flex flex-wrap gap-3">
                <button
                  onClick={() => updateVideo(selectedVideo.viewkey, { status: "pending" })}
                  className="flex-1 min-w-[120px] px-4 py-2 rounded-xl font-semibold bg-white/10 text-white border border-white/30 hover:bg-white/20 transition"
                >
                  Move to Pending
                </button>
                <button
                  onClick={() => updateVideo(selectedVideo.viewkey, { status: "maybe" })}
                  className="flex-1 min-w-[120px] px-4 py-2 rounded-xl font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-400/50 hover:bg-yellow-500/30 transition"
                >
                  Move to Maybe
                </button>
                <button
                  onClick={() => updateVideo(selectedVideo.viewkey, { status: "rejected" })}
                  className="flex-1 min-w-[120px] px-4 py-2 rounded-xl font-semibold bg-red-500/20 text-red-300 border border-red-400/50 hover:bg-red-500/30 transition"
                >
                  Reject
                </button>
                <button
                  onClick={() => updateVideo(selectedVideo.viewkey, { favorite: selectedVideo.favorite !== 1 })}
                  className={`px-4 py-2 rounded-xl font-semibold transition ${
                    selectedVideo.favorite === 1
                      ? "bg-yellow-500/30 text-yellow-300 border border-yellow-400"
                      : "bg-black/40 text-white border border-white/30 hover:border-yellow-400"
                  }`}
                >
                  ★
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
