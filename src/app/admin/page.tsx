"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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

type Cursor = { views: number; viewkey: string } | null;

type Stats = {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  favorites: number;
};

type ApiResponse = {
  videos: Video[];
  nextCursor: Cursor;
  hasMore: boolean;
  stats: Stats;
  categories: string[];
};

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "maybe";

export default function AdminPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, approved: 0, rejected: 0, pending: 0, favorites: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  // Cursor-based pagination
  const [cursorStack, setCursorStack] = useState<Cursor[]>([null]); // Stack of previous cursors for "back"
  const [nextCursor, setNextCursor] = useState<Cursor>(null);
  const [hasMore, setHasMore] = useState(false);

  // Modal state
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [editingNote, setEditingNote] = useState("");

  const fetchVideos = useCallback(async (cursor: Cursor = null, resetStack = false) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (favoriteOnly) params.set("favorite", "1");
    if (cursor) {
      params.set("cursorViews", String(cursor.views));
      params.set("cursorViewkey", cursor.viewkey);
    }

    const res = await fetch(`/api/admin/videos?${params}`);
    const data: ApiResponse = await res.json();

    setVideos(data.videos);
    setNextCursor(data.nextCursor);
    setHasMore(data.hasMore);
    setStats(data.stats);

    if (resetStack) {
      setCursorStack([null]);
    }

    setLoading(false);
  }, [search, statusFilter, favoriteOnly]);

  // Initial load and when filters change
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
      newStack.pop(); // Remove current
      const prevCursor = newStack[newStack.length - 1];
      setCursorStack(newStack);
      fetchVideos(prevCursor);
    }
  };

  const updateVideo = async (viewkey: string, patch: { status?: string; note?: string; favorite?: boolean }) => {
    await fetch(`/api/admin/videos/${viewkey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    // Refresh the list
    const currentCursor = cursorStack[cursorStack.length - 1];
    await fetchVideos(currentCursor);

    // Update modal if open
    if (selectedVideo?.viewkey === viewkey) {
      const res = await fetch(`/api/admin/videos/${viewkey}`);
      const updated = await res.json();
      setSelectedVideo(updated);
    }
  };

  const exportApproved = async () => {
    setExporting(true);
    const res = await fetch("/api/admin/export", { method: "POST" });
    const data = await res.json();
    setExporting(false);

    if (data.ok) {
      alert(`Exported ${data.exported} videos to ${data.file}`);
    } else {
      alert("Export failed");
    }
  };

  const openModal = (video: Video) => {
    setSelectedVideo(video);
    setEditingNote(video.note || "");
  };

  const closeModal = () => {
    setSelectedVideo(null);
    setEditingNote("");
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "text-emerald-400 border-emerald-400/50 bg-emerald-500/20";
      case "rejected": return "text-red-400 border-red-400/50 bg-red-500/20";
      case "maybe": return "text-yellow-400 border-yellow-400/50 bg-yellow-500/20";
      default: return "text-white/50 border-white/20 bg-black/40";
    }
  };

  return (
    <main className="min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold neon-text">Admin Panel</h1>
          <p className="text-white/60 text-sm mt-1">FTS5 search + keyset pagination</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportApproved}
            disabled={exporting}
            className="px-4 py-2 rounded-full border border-emerald-400/50 bg-emerald-500/20 text-white text-sm font-semibold hover:bg-emerald-500/30 transition disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export approved.json"}
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-full border border-pink-400/50 bg-pink-500/20 text-white text-sm font-semibold hover:bg-pink-500/30 transition"
          >
            Back to Site
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <div className="neon-border rounded-xl p-3 bg-black/30">
          <div className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</div>
          <div className="text-xs text-white/60">Total</div>
        </div>
        <div className="rounded-xl p-3 bg-black/30 border border-white/20">
          <div className="text-2xl font-bold text-white/70">{stats.pending.toLocaleString()}</div>
          <div className="text-xs text-white/60">Pending</div>
        </div>
        <div className="rounded-xl p-3 bg-black/30 border border-emerald-400/50">
          <div className="text-2xl font-bold text-emerald-400">{stats.approved.toLocaleString()}</div>
          <div className="text-xs text-white/60">Approved</div>
        </div>
        <div className="rounded-xl p-3 bg-black/30 border border-red-400/50">
          <div className="text-2xl font-bold text-red-400">{stats.rejected.toLocaleString()}</div>
          <div className="text-xs text-white/60">Rejected</div>
        </div>
        <div className="rounded-xl p-3 bg-black/30 border border-yellow-400/50">
          <div className="text-2xl font-bold text-yellow-400">{stats.favorites.toLocaleString()}</div>
          <div className="text-xs text-white/60">Favorites</div>
        </div>
      </div>

      {/* Filters */}
      <div className="neon-border rounded-xl p-4 bg-black/30 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-white/70 mb-1">FTS5 Search</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search title, tags, performers..."
                className="flex-1 rounded-xl bg-black/40 neon-border px-3 py-2 text-white placeholder:text-white/40"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 rounded-xl bg-pink-500/30 text-pink-300 border border-pink-400 font-semibold hover:bg-pink-500/40 transition"
              >
                Search
              </button>
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs text-white/70 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-xl bg-black/40 neon-border px-3 py-2 text-white"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="maybe">Maybe</option>
            </select>
          </div>

          {/* Favorite Toggle */}
          <button
            onClick={() => setFavoriteOnly(!favoriteOnly)}
            className={`px-4 py-2 rounded-xl border text-sm font-semibold transition ${
              favoriteOnly
                ? "border-yellow-400 bg-yellow-500/30 text-yellow-300"
                : "border-white/30 bg-black/40 text-white/60 hover:border-white/50"
            }`}
          >
            Favorites Only
          </button>
        </div>
      </div>

      {/* Video Grid */}
      {loading ? (
        <div className="text-center py-12 text-white/60">Loading...</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 text-white/60">No videos found</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {videos.map((video) => (
              <div
                key={video.viewkey}
                className="neon-border rounded-xl bg-black/30 overflow-hidden group relative"
              >
                {/* Thumbnail */}
                <div
                  onClick={() => openModal(video)}
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
                </div>

                {/* Info */}
                <div className="p-3">
                  <div
                    onClick={() => openModal(video)}
                    className="font-semibold text-sm text-white line-clamp-2 cursor-pointer hover:text-pink-300 transition"
                  >
                    {video.title || "(no title)"}
                  </div>
                  <div className="mt-1 text-xs text-white/50">{formatViews(video.views)} views</div>

                  {/* Status + Actions */}
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <span className={`px-2 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(video.status)}`}>
                      {video.status}
                    </span>
                    {video.favorite === 1 && (
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold border border-yellow-400/50 bg-yellow-500/20 text-yellow-300">
                        ★
                      </span>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-2 flex gap-1">
                    <button
                      onClick={() => updateVideo(video.viewkey, { status: "approved" })}
                      title="Approve"
                      className="flex-1 px-2 py-1 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/30 transition"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => updateVideo(video.viewkey, { status: "rejected" })}
                      title="Reject"
                      className="flex-1 px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-300 border border-red-400/30 hover:bg-red-500/30 transition"
                    >
                      ✗
                    </button>
                    <button
                      onClick={() => updateVideo(video.viewkey, { status: "maybe" })}
                      title="Maybe"
                      className="flex-1 px-2 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-400/30 hover:bg-yellow-500/30 transition"
                    >
                      ?
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

          {/* Keyset Pagination */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={goPrev}
              disabled={cursorStack.length <= 1}
              className="px-4 py-2 rounded-xl border border-white/30 bg-black/40 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:border-pink-400/50 transition"
            >
              Previous
            </button>
            <span className="text-white/60 text-sm">
              Page {cursorStack.length} {hasMore ? "" : "(last)"}
            </span>
            <button
              onClick={goNext}
              disabled={!hasMore}
              className="px-4 py-2 rounded-xl border border-white/30 bg-black/40 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:border-pink-400/50 transition"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={closeModal}
        >
          <div
            className="bg-[#0a0f1e] neon-border rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-pink-400/30 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedVideo.title}</h2>
                <div className="mt-1 text-sm text-white/60">
                  viewkey: {selectedVideo.viewkey}
                </div>
              </div>
              <button
                onClick={closeModal}
                className="text-white/60 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Video Embed */}
            <div className="p-4">
              <div className="aspect-video bg-black rounded-xl overflow-hidden">
                <iframe
                  src={`https://www.pornhub.com/embed/${selectedVideo.viewkey}`}
                  frameBorder={0}
                  width="100%"
                  height="100%"
                  allowFullScreen
                />
              </div>
            </div>

            {/* Details */}
            <div className="p-4 border-t border-pink-400/30 grid grid-cols-2 gap-4 text-sm">
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
              <div className="col-span-2">
                <span className="text-white/50">Tags:</span>{" "}
                <span className="text-white text-xs">{selectedVideo.tags || "N/A"}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-pink-400/30">
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => updateVideo(selectedVideo.viewkey, { status: "approved" })}
                  className={`flex-1 px-4 py-2 rounded-xl font-semibold transition ${
                    selectedVideo.status === "approved"
                      ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400"
                      : "bg-black/40 text-white border border-white/30 hover:border-emerald-400"
                  }`}
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => updateVideo(selectedVideo.viewkey, { status: "rejected" })}
                  className={`flex-1 px-4 py-2 rounded-xl font-semibold transition ${
                    selectedVideo.status === "rejected"
                      ? "bg-red-500/30 text-red-300 border border-red-400"
                      : "bg-black/40 text-white border border-white/30 hover:border-red-400"
                  }`}
                >
                  ✗ Reject
                </button>
                <button
                  onClick={() => updateVideo(selectedVideo.viewkey, { status: "maybe" })}
                  className={`flex-1 px-4 py-2 rounded-xl font-semibold transition ${
                    selectedVideo.status === "maybe"
                      ? "bg-yellow-500/30 text-yellow-300 border border-yellow-400"
                      : "bg-black/40 text-white border border-white/30 hover:border-yellow-400"
                  }`}
                >
                  ? Maybe
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

              {/* Notes */}
              <div>
                <label className="block text-sm text-white/70 mb-2">Notes</label>
                <textarea
                  value={editingNote}
                  onChange={(e) => setEditingNote(e.target.value)}
                  placeholder="Add notes about this video..."
                  className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white placeholder:text-white/40 h-20 resize-none"
                />
                <button
                  onClick={() => updateVideo(selectedVideo.viewkey, { note: editingNote })}
                  className="mt-2 px-4 py-2 rounded-xl bg-pink-500/30 text-pink-300 border border-pink-400 font-semibold hover:bg-pink-500/40 transition"
                >
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
