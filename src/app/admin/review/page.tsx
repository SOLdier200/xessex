"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Script from "next/script";
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
type DbSource = "embeds" | "xvidprem";

type ApiResponse = {
  videos: Video[];
  nextCursor: Cursor;
  hasMore: boolean;
  stats: { approved: number };
  source: DbSource;
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

  // Get correct embed URL based on database source
  const getEmbedUrl = (viewkey: string) => {
    if (dbSource === "xvidprem") {
      return `https://www.xvideos.com/embedframe/${viewkey}`;
    }
    return `https://www.pornhub.com/embed/${viewkey}`;
  };

  const fetchVideos = useCallback(async (cursor: Cursor = null, resetStack = false) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("source", dbSource);
    params.set("status", "approved"); // Always filter to approved only
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

  useEffect(() => {
    fetchVideos(null, true);
  }, [fetchVideos]);

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

    // Refresh the list
    const currentCursor = cursorStack[cursorStack.length - 1];
    await fetchVideos(currentCursor);

    // Close modal if video was moved out of approved
    if (patch.status && patch.status !== "approved") {
      setSelectedVideo(null);
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
      {/* X-Frame-Bypass scripts for embedding xvideos */}
      <Script src="https://unpkg.com/@ungap/custom-elements-builtin" strategy="beforeInteractive" />
      <Script type="module" src="https://unpkg.com/x-frame-bypass" strategy="beforeInteractive" />

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
          onClick={() => setDbSource("xvidprem")}
          className={`px-6 py-3 rounded-xl font-bold text-lg transition ${
            dbSource === "xvidprem"
              ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30"
              : "bg-black/40 text-white/60 border border-white/20 hover:border-white/40"
          }`}
        >
          Xvidprem DB
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
        <div className="fixed inset-0 bg-black/80 flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh] z-50">
          <div className="bg-[#0a0f1e] neon-border rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-4 border-b border-emerald-400/30 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedVideo.title}</h2>
                <div className="mt-1 text-sm text-white/60">
                  viewkey: {selectedVideo.viewkey}
                </div>
              </div>
              <button
                onClick={() => setSelectedVideo(null)}
                className="text-white/60 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Video Embed */}
            <div className="p-4">
              <div className="bg-black rounded-xl overflow-hidden aspect-video">
                {dbSource === "xvidprem" ? (
                  <iframe
                    is="x-frame-bypass"
                    src={getEmbedUrl(selectedVideo.viewkey)}
                    frameBorder={0}
                    width="100%"
                    height="100%"
                    allowFullScreen
                  />
                ) : (
                  <iframe
                    src={getEmbedUrl(selectedVideo.viewkey)}
                    frameBorder={0}
                    width="100%"
                    height="100%"
                    allowFullScreen
                  />
                )}
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
            <div className="p-4 border-t border-emerald-400/30 flex gap-3">
              <button
                onClick={() => updateVideo(selectedVideo.viewkey, { status: "pending" })}
                className="flex-1 px-4 py-2 rounded-xl font-semibold bg-white/10 text-white border border-white/30 hover:bg-white/20 transition"
              >
                Move to Pending
              </button>
              <button
                onClick={() => updateVideo(selectedVideo.viewkey, { status: "maybe" })}
                className="flex-1 px-4 py-2 rounded-xl font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-400/50 hover:bg-yellow-500/30 transition"
              >
                Move to Maybe
              </button>
              <button
                onClick={() => updateVideo(selectedVideo.viewkey, { status: "rejected" })}
                className="flex-1 px-4 py-2 rounded-xl font-semibold bg-red-500/20 text-red-300 border border-red-400/50 hover:bg-red-500/30 transition"
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
      )}

    </main>
  );
}
