"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import ReportedCommentsPanel from "@/app/components/mod/ReportedCommentsPanel";

type Toast = {
  id: number;
  message: string;
  type: "loading" | "success" | "error";
};

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm border transition-all duration-300 ${
            toast.type === "loading"
              ? "bg-purple-500/20 border-purple-400/50 text-purple-200"
              : toast.type === "success"
              ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-200"
              : "bg-red-500/20 border-red-400/50 text-red-200"
          }`}
        >
          {toast.type === "loading" && (
            <div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          )}
          {toast.type === "success" && <span className="text-lg">✓</span>}
          {toast.type === "error" && <span className="text-lg">✗</span>}
          <span className="text-sm font-medium">{toast.message}</span>
          {toast.type !== "loading" && (
            <button
              onClick={() => onDismiss(toast.id)}
              className="ml-2 text-white/50 hover:text-white transition"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

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
type SortBy = "views" | "duration";
type SortDir = "desc" | "asc";
type DbSource = "embeds" | "youporn";

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

type StatusFilter = "all" | "pending" | "rejected" | "maybe";

export default function AdminPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, approved: 0, rejected: 0, pending: 0, favorites: 0 });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (type !== "loading") {
      setTimeout(() => dismissToast(id), 4000);
    }
    return id;
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id: number, message: string, type: Toast["type"]) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, message, type } : t))
    );
    if (type !== "loading") {
      setTimeout(() => dismissToast(id), 4000);
    }
  }, [dismissToast]);

  // Database source
  const [dbSource, setDbSource] = useState<DbSource>("embeds");

  // Filters
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("views");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Cursor-based pagination
  const [cursorStack, setCursorStack] = useState<Cursor[]>([null]); // Stack of previous cursors for "back"
  const [nextCursor, setNextCursor] = useState<Cursor>(null);
  const [hasMore, setHasMore] = useState(false);

  // Modal state
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [modalSize, setModalSize] = useState({ width: 900, height: 700 });
  const [isResizing, setIsResizing] = useState(false);
  const [minimizeState, setMinimizeState] = useState<"full" | "pip" | "micro">("full");
  const [pipPosition, setPipPosition] = useState({ x: 20, y: 20 }); // bottom-right offset
  const justResizedRef = useRef(false);
  const isDraggingPip = useRef(false);

  const fetchVideos = useCallback(async (cursor: Cursor = null, resetStack = false) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("source", dbSource);
    if (search) params.set("search", search);
    if (statusFilter === "all") {
      params.set("excludeApproved", "1"); // Exclude approved from main curation view
    } else {
      params.set("status", statusFilter);
    }
    if (favoriteOnly) params.set("favorite", "1");
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    if (cursor) {
      params.set("cursorValue", String(cursor.value));
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
  }, [dbSource, search, statusFilter, favoriteOnly, sortBy, sortDir]);

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
      body: JSON.stringify({ ...patch, source: dbSource }),
    });

    // Refresh the list
    const currentCursor = cursorStack[cursorStack.length - 1];
    await fetchVideos(currentCursor);

    // Update modal if open
    if (selectedVideo?.viewkey === viewkey) {
      const res = await fetch(`/api/admin/videos/${viewkey}?source=${dbSource}`);
      const updated = await res.json();
      setSelectedVideo(updated);
    }
  };

  const deleteRejected = async () => {
    if (!confirm(`Are you sure you want to permanently delete all ${stats.rejected} rejected videos? This cannot be undone!`)) {
      return;
    }
    setDeleting(true);
    const res = await fetch(`/api/admin/videos/rejected?source=${dbSource}`, { method: "DELETE" });
    const data = await res.json();
    setDeleting(false);

    if (data.ok) {
      alert(`Deleted ${data.deleted} rejected videos`);
      fetchVideos(null, true); // Refresh the list
    } else {
      alert("Delete failed");
    }
  };

  const openModal = (video: Video) => {
    setSelectedVideo(video);
    setEditingNote(video.note || "");
  };

  const closeModal = () => {
    setSelectedVideo(null);
    setEditingNote("");
    setMinimizeState("full");
    setPipPosition({ x: 20, y: 20 });
  };

  const handlePipDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingPip.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPosX = pipPosition.x;
    const startPosY = pipPosition.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const deltaY = startY - moveEvent.clientY;
      setPipPosition({
        x: Math.max(0, Math.min(window.innerWidth - 100, startPosX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - 50, startPosY + deltaY)),
      });
    };

    const handleMouseUp = () => {
      isDraggingPip.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = modalSize.width;
    const startHeight = modalSize.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      let newWidth = startWidth;
      let newHeight = startHeight;

      if (direction.includes("e")) {
        newWidth = Math.max(400, Math.min(window.innerWidth - 40, startWidth + (moveEvent.clientX - startX)));
      }
      if (direction.includes("w")) {
        newWidth = Math.max(400, Math.min(window.innerWidth - 40, startWidth - (moveEvent.clientX - startX)));
      }
      if (direction.includes("s")) {
        newHeight = Math.max(300, Math.min(window.innerHeight - 40, startHeight + (moveEvent.clientY - startY)));
      }
      if (direction.includes("n")) {
        newHeight = Math.max(300, Math.min(window.innerHeight - 40, startHeight - (moveEvent.clientY - startY)));
      }

      setModalSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      justResizedRef.current = true;
      setTimeout(() => { justResizedRef.current = false; }, 100);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
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

  // Get correct embed URL based on database source
  const getEmbedUrl = (viewkey: string) => {
    if (dbSource === "youporn") {
      return `https://www.youporn.com/embed/${viewkey}`;
    }
    return `https://www.pornhub.com/embed/${viewkey}`;
  };

  return (
    <main className="min-h-screen p-6">
      {/* Progress Banner */}
      <div className="mb-4 py-3 px-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 rounded-xl text-center border border-emerald-400/50 shadow-lg">
        <span className="text-xl font-bold text-white">
          Keep it up! Only <span className="text-yellow-300">{stats.pending.toLocaleString()}</span> videos left to curate
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold neon-text">Admin Video Selector</h1>
          <p className="text-white/60 text-sm mt-1">FTS5 search + keyset pagination</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/admin/controls"
            className="px-4 py-2 rounded-full border border-purple-400/50 bg-purple-500/20 text-white text-sm font-semibold hover:bg-purple-500/30 transition"
          >
            Admin Controls
          </Link>
          <Link
            href="/admin/review"
            className="px-4 py-2 rounded-full border border-sky-400/50 bg-sky-500/20 text-white text-sm font-semibold hover:bg-sky-500/30 transition"
          >
            Review Approved ({stats.approved})
          </Link>
          <button
            onClick={deleteRejected}
            disabled={deleting || stats.rejected === 0}
            className="px-4 py-2 rounded-full border border-red-400/50 bg-red-500/20 text-white text-sm font-semibold hover:bg-red-500/30 transition disabled:opacity-50"
          >
            {deleting ? "Deleting..." : `Delete Rejected (${stats.rejected})`}
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-full border border-pink-400/50 bg-pink-500/20 text-white text-sm font-semibold hover:bg-pink-500/30 transition"
          >
            Back to Site
          </Link>
        </div>
      </div>

      <ReportedCommentsPanel />

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
              <option value="all">All (excl. Approved)</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="maybe">Maybe</option>
            </select>
          </div>

          {/* Sort Options */}
          <div>
            <label className="block text-xs text-white/70 mb-1">Sort By</label>
            <select
              value={`${sortBy}-${sortDir}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split("-") as [SortBy, SortDir];
                setSortBy(field);
                setSortDir(dir);
              }}
              className="rounded-xl bg-black/40 neon-border px-3 py-2 text-white"
            >
              <option value="views-desc">Views (High to Low)</option>
              <option value="views-asc">Views (Low to High)</option>
              <option value="duration-desc">Duration (Longest)</option>
              <option value="duration-asc">Duration (Shortest)</option>
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

      {/* Persistent Video Player - Always mounted when video selected */}
      {selectedVideo && (
        <>
          {/* The actual iframe - positioned based on minimize state */}
          <div
            className={`fixed z-50 ${
              minimizeState === "micro"
                ? "w-1 h-1 opacity-0 pointer-events-none"
                : minimizeState === "pip"
                ? "neon-border rounded-xl overflow-hidden bg-black shadow-2xl"
                : "rounded-xl overflow-hidden bg-black"
            }`}
            style={
              minimizeState === "full"
                ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: modalSize.width - 32, height: (modalSize.width - 32) * 9 / 16, maxWidth: "calc(95vw - 32px)", maxHeight: "50vh", zIndex: 51 }
                : minimizeState === "pip"
                ? { width: 320, height: 200, right: pipPosition.x, bottom: pipPosition.y }
                : { right: pipPosition.x, bottom: pipPosition.y, width: 1, height: 1 }
            }
          >
<iframe
                src={getEmbedUrl(selectedVideo.viewkey)}
                frameBorder={0}
                width="100%"
                height="100%"
                allowFullScreen
              />
            {/* PiP Controls Overlay */}
            {minimizeState === "pip" && (
              <>
                {/* Drag handle - covers top portion */}
                <div
                  className="absolute top-0 left-0 right-0 h-10 cursor-move"
                  onMouseDown={handlePipDragStart}
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => setMinimizeState("full")}
                    className="w-7 h-7 rounded bg-black/70 text-white hover:bg-pink-500/50 flex items-center justify-center text-lg"
                    title="Maximize"
                  >
                    ⤢
                  </button>
                  <button
                    onClick={() => setMinimizeState("micro")}
                    className="w-7 h-7 rounded bg-black/70 text-white hover:bg-purple-500/50 flex items-center justify-center text-sm"
                    title="Audio Only"
                  >
                    🔊
                  </button>
                  <button
                    onClick={closeModal}
                    className="w-7 h-7 rounded bg-black/70 text-white hover:bg-red-500/50 flex items-center justify-center text-lg"
                    title="Close"
                  >
                    ×
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1 text-xs text-white truncate pointer-events-none">
                  {selectedVideo.title}
                </div>
              </>
            )}
          </div>

          {/* Micro Mode Controls */}
          {minimizeState === "micro" && (
            <div
              className="fixed z-50 neon-border rounded-lg overflow-hidden bg-black/90 shadow-2xl cursor-move flex items-center gap-2 px-3 py-2"
              style={{ right: pipPosition.x, bottom: pipPosition.y }}
              onMouseDown={handlePipDragStart}
            >
              <div className="text-pink-400 animate-pulse text-lg">🔊</div>
              <div className="text-white text-xs max-w-[150px] truncate">{selectedVideo.title}</div>
              <div className="flex gap-1" onMouseDown={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setMinimizeState("pip")}
                  className="w-6 h-6 rounded bg-pink-500/30 text-white hover:bg-pink-500/50 flex items-center justify-center text-sm"
                  title="Show Video"
                >
                  ▶
                </button>
                <button
                  onClick={() => setMinimizeState("full")}
                  className="w-6 h-6 rounded bg-purple-500/30 text-white hover:bg-purple-500/50 flex items-center justify-center text-sm"
                  title="Maximize"
                >
                  ⤢
                </button>
                <button
                  onClick={closeModal}
                  className="w-6 h-6 rounded bg-red-500/30 text-white hover:bg-red-500/50 flex items-center justify-center text-sm"
                  title="Close"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Full Modal */}
      {selectedVideo && minimizeState === "full" && (
        <div
          className={`fixed inset-0 bg-black/80 flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh] z-50 ${isResizing ? "cursor-se-resize select-none" : ""}`}
        >
          <div
            className="bg-[#0a0f1e] neon-border rounded-2xl relative flex flex-col"
            style={{ width: modalSize.width, height: modalSize.height, maxWidth: "95vw", maxHeight: "95vh" }}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-pink-400/30 flex items-start justify-between shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedVideo.title}</h2>
                <div className="mt-1 text-sm text-white/60">
                  viewkey: {selectedVideo.viewkey}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setMinimizeState("pip")}
                  className="text-white/60 hover:text-pink-400 text-xl leading-none px-1"
                  title="Minimize to PiP"
                >
                  −
                </button>
                <button
                  onClick={() => setMinimizeState("micro")}
                  className="text-white/60 hover:text-purple-400 text-lg leading-none px-1"
                  title="Audio Only"
                >
                  🔊
                </button>
                <button
                  onClick={closeModal}
                  className="text-white/60 hover:text-white text-2xl leading-none"
                  title="Close"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">

            {/* Video Embed Placeholder - actual video is in persistent player above */}
            <div className="p-4">
              <div className="aspect-video bg-black rounded-xl overflow-hidden">
                {/* Video plays in the persistent iframe above */}
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
            </div>{/* End Scrollable Content */}

            {/* Resize Handles - All Edges and Corners */}
            {/* Edges */}
            <div onMouseDown={(e) => handleResizeStart(e, "n")} className="absolute top-0 left-3 right-3 h-2 cursor-n-resize hover:bg-pink-400/20 transition" />
            <div onMouseDown={(e) => handleResizeStart(e, "s")} className="absolute bottom-0 left-3 right-3 h-2 cursor-s-resize hover:bg-pink-400/20 transition" />
            <div onMouseDown={(e) => handleResizeStart(e, "w")} className="absolute left-0 top-3 bottom-3 w-2 cursor-w-resize hover:bg-pink-400/20 transition" />
            <div onMouseDown={(e) => handleResizeStart(e, "e")} className="absolute right-0 top-3 bottom-3 w-2 cursor-e-resize hover:bg-pink-400/20 transition" />
            {/* Corners */}
            <div onMouseDown={(e) => handleResizeStart(e, "nw")} className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize hover:bg-pink-400/30 transition" />
            <div onMouseDown={(e) => handleResizeStart(e, "ne")} className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize hover:bg-pink-400/30 transition" />
            <div onMouseDown={(e) => handleResizeStart(e, "sw")} className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize hover:bg-pink-400/30 transition" />
            <div onMouseDown={(e) => handleResizeStart(e, "se")} className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize hover:bg-pink-400/30 transition" />
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
