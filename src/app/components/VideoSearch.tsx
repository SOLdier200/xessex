"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Video = {
  viewkey: string;
  title: string;
  primary_thumb: string | null;
  duration: number | null;
  views: number | null;
  tags: string | null;
  categories: string | null;
  performers: string | null;
  favorite: number;
  rank?: number | null;
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatViews(views: number | null): string {
  if (!views) return "--";
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return views.toString();
}

interface VideoSearchProps {
  videos: Video[];
  isAuthed?: boolean;
  freeSlugs?: string[];
  unlockedSlugs?: string[];
  creditBalance?: number;
  initialUnlockedCount?: number;
  initialNextCost?: number;
}

// Session storage key for scroll position
const SCROLL_KEY = "xessex_videos_scroll";

export default function VideoSearch({
  videos,
  isAuthed = false,
  freeSlugs = [],
  unlockedSlugs = [],
  creditBalance = 0,
  initialUnlockedCount = 0,
  initialNextCost = 10,
}: VideoSearchProps) {
  const VIDEOS_PER_PAGE = 50;
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial state from URL params
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("cat") || "all");
  const [duration, setDuration] = useState(searchParams.get("dur") || "any");
  const [sort, setSort] = useState(searchParams.get("sort") || "rank");
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get("page") || "1", 10);
    return p >= 1 ? p : 1;
  });

  // Unlock modal state
  const [unlockModal, setUnlockModal] = useState<{ videoId: string; title: string } | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [localCredits, setLocalCredits] = useState(creditBalance);
  const [localUnlockedSlugs, setLocalUnlockedSlugs] = useState<string[]>(unlockedSlugs);
  const [unlockedCount, setUnlockedCount] = useState(initialUnlockedCount);
  const [nextCost, setNextCost] = useState(initialNextCost);

  // Sync credit balance when prop changes
  useEffect(() => {
    setLocalCredits(creditBalance);
  }, [creditBalance]);

  // Sync unlocked slugs when prop changes
  useEffect(() => {
    setLocalUnlockedSlugs(unlockedSlugs);
  }, [unlockedSlugs]);

  // Sync unlock count and next cost when props change
  useEffect(() => {
    setUnlockedCount(initialUnlockedCount);
  }, [initialUnlockedCount]);

  useEffect(() => {
    setNextCost(initialNextCost);
  }, [initialNextCost]);

  // Fetch unlock summary on mount if authed (to get latest pricing)
  useEffect(() => {
    if (!isAuthed) return;
    fetch("/api/videos/unlocks/summary")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setUnlockedCount(d.unlockedCount);
          setNextCost(d.nextCost);
          setLocalCredits(d.creditBalance);
        }
      })
      .catch(() => {});
  }, [isAuthed]);

  // Listen for credits-changed event to refresh credit balance
  useEffect(() => {
    if (!isAuthed) return;
    const handleCreditsChange = () => {
      fetch("/api/videos/unlocks/summary")
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            setLocalCredits(d.creditBalance);
          }
        })
        .catch(() => {});
    };
    window.addEventListener("credits-changed", handleCreditsChange);
    return () => window.removeEventListener("credits-changed", handleCreditsChange);
  }, [isAuthed]);

  const canAfford = localCredits >= nextCost;

  async function handleUnlock(videoKey: string) {
    setUnlockError(null);
    setIsUnlocking(true);
    try {
      const res = await fetch(`/api/videos/${videoKey}/unlock`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setUnlockError(json?.error ?? "unlock_failed");
        return;
      }
      // Update local state with new balance, count, and next cost
      // Use videoSlug from response (canonical slug) for local state tracking
      setLocalCredits(json.creditBalance);
      setLocalUnlockedSlugs((prev) => [...prev, json.videoSlug ?? videoKey]);
      setUnlockedCount(json.unlockedCount);
      setNextCost(json.nextCost);
      setUnlockModal(null);
      // Dispatch event to update wallet status display
      window.dispatchEvent(new CustomEvent("credits-changed"));
      // Optionally refresh the page to get fresh data
      router.refresh();
    } catch {
      setUnlockError("network_error");
    } finally {
      setIsUnlocking(false);
    }
  }

  // Sync state to URL (without adding to history for filter changes, with history for page changes)
  const updateUrl = useCallback((newParams: Record<string, string | number>, replace = false) => {
    const params = new URLSearchParams();

    const finalSearch = "q" in newParams ? String(newParams.q) : search;
    const finalCategory = "cat" in newParams ? String(newParams.cat) : category;
    const finalDuration = "dur" in newParams ? String(newParams.dur) : duration;
    const finalSort = "sort" in newParams ? String(newParams.sort) : sort;
    const finalPage = "page" in newParams ? Number(newParams.page) : page;

    if (finalSearch) params.set("q", finalSearch);
    if (finalCategory !== "all") params.set("cat", finalCategory);
    if (finalDuration !== "any") params.set("dur", finalDuration);
    if (finalSort !== "rank") params.set("sort", finalSort);
    if (finalPage > 1) params.set("page", String(finalPage));

    const queryString = params.toString();
    const newUrl = queryString ? `/videos?${queryString}` : "/videos";

    if (replace) {
      router.replace(newUrl, { scroll: false });
    } else {
      router.push(newUrl, { scroll: false });
    }
  }, [router, search, category, duration, sort, page]);

  // Save scroll position before navigating away
  useEffect(() => {
    const saveScroll = () => {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    };

    // Save on any link click within the video grid
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('a[href^="/videos/"]')) {
        saveScroll();
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Restore scroll position on mount (back navigation)
  useEffect(() => {
    const savedScroll = sessionStorage.getItem(SCROLL_KEY);
    if (savedScroll) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScroll, 10));
        sessionStorage.removeItem(SCROLL_KEY);
      }, 100);
    }
  }, []);

  const filteredVideos = useMemo(() => {
    let result = [...videos];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.title?.toLowerCase().includes(q) ||
          v.tags?.toLowerCase().includes(q) ||
          v.performers?.toLowerCase().includes(q) ||
          v.categories?.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (category !== "all") {
      const catName = category.replace("-", " ");
      result = result.filter((v) =>
        v.categories?.toLowerCase().includes(catName)
      );
    }

    // Duration filter
    if (duration !== "any") {
      result = result.filter((v) => {
        const d = v.duration || 0;
        if (duration === "short") return d <= 600;
        if (duration === "mid") return d > 600 && d <= 1800;
        if (duration === "long") return d > 1800;
        return true;
      });
    }

    // Sort
    if (sort === "rank") {
      result.sort((a, b) => {
        // Videos with rank come first, sorted ascending
        if (a.rank != null && b.rank != null) return a.rank - b.rank;
        if (a.rank != null) return -1;
        if (b.rank != null) return 1;
        return 0;
      });
    } else if (sort === "top") {
      result.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (sort === "duration") {
      result.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    }
    // "new" keeps original order

    // For non-authed users, put free videos at the top
    if (!isAuthed && freeSlugs.length > 0) {
      const freeSet = new Set(freeSlugs);
      result.sort((a, b) => {
        const aIsFree = freeSet.has(a.viewkey);
        const bIsFree = freeSet.has(b.viewkey);
        if (aIsFree && !bIsFree) return -1;
        if (!aIsFree && bIsFree) return 1;
        return 0;
      });
    }

    // For authed users, put unlocked/free videos first (sorted by rank), then locked videos (sorted by rank)
    if (isAuthed) {
      const freeSet = new Set(freeSlugs);
      const unlockedSet = new Set(localUnlockedSlugs);
      result.sort((a, b) => {
        const aUnlocked = freeSet.has(a.viewkey) || unlockedSet.has(a.viewkey);
        const bUnlocked = freeSet.has(b.viewkey) || unlockedSet.has(b.viewkey);

        // Unlocked videos come first
        if (aUnlocked && !bUnlocked) return -1;
        if (!aUnlocked && bUnlocked) return 1;

        // Within same group (both unlocked or both locked), sort by rank
        if (a.rank != null && b.rank != null) return a.rank - b.rank;
        if (a.rank != null) return -1;
        if (b.rank != null) return 1;
        return 0;
      });
    }

    return result;
  }, [videos, search, category, duration, sort, isAuthed, freeSlugs, localUnlockedSlugs]);

  // Ref to track if we're syncing from URL (to prevent reverse sync)
  const isSyncingFromUrl = useRef(false);

  // Sync state FROM URL when user navigates back/forward
  useEffect(() => {
    const urlSearch = searchParams.get("q") || "";
    const urlCategory = searchParams.get("cat") || "all";
    const urlDuration = searchParams.get("dur") || "any";
    const urlSort = searchParams.get("sort") || "rank";
    const urlPage = parseInt(searchParams.get("page") || "1", 10);

    // Check if anything changed
    const hasChanges =
      urlSearch !== search ||
      urlCategory !== category ||
      urlDuration !== duration ||
      urlSort !== sort ||
      (urlPage !== page && urlPage >= 1);

    if (hasChanges) {
      isSyncingFromUrl.current = true;
      if (urlSearch !== search) setSearch(urlSearch);
      if (urlCategory !== category) setCategory(urlCategory);
      if (urlDuration !== duration) setDuration(urlDuration);
      if (urlSort !== sort) setSort(urlSort);
      if (urlPage !== page && urlPage >= 1) setPage(urlPage);
      // Reset flag after state updates are processed
      setTimeout(() => { isSyncingFromUrl.current = false; }, 0);
    }
  }, [searchParams]);
  // Note: state vars intentionally omitted from deps - we're syncing FROM URL TO state

  // Track previous values to detect user-initiated filter changes
  const [prevFilters, setPrevFilters] = useState({ search, category, duration, sort });

  // Sync filter changes TO URL (when user changes filters, not from URL sync)
  useEffect(() => {
    // Skip if we're syncing from URL
    if (isSyncingFromUrl.current) return;

    const filtersChanged =
      search !== prevFilters.search ||
      category !== prevFilters.category ||
      duration !== prevFilters.duration ||
      sort !== prevFilters.sort;

    if (filtersChanged) {
      setPage(1);
      updateUrl({ q: search, cat: category, dur: duration, sort, page: 1 }, true);
      setPrevFilters({ search, category, duration, sort });
    }
  }, [search, category, duration, sort]);
  // Note: prevFilters and updateUrl intentionally omitted to avoid loops

  const totalPages = Math.ceil(filteredVideos.length / VIDEOS_PER_PAGE);
  const startIndex = (page - 1) * VIDEOS_PER_PAGE;
  const endIndex = startIndex + VIDEOS_PER_PAGE;
  const paginatedVideos = filteredVideos.slice(startIndex, endIndex);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is already reactive via useMemo
  };

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      // Use push (not replace) so back button works for page navigation
      updateUrl({ page: newPage }, false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <>
      <section className="neon-border rounded-2xl p-4 md:p-6 bg-black/30">
        <div className="flex flex-col gap-2">
          <img src="/logos/textlogo/siteset3/seachvids1200.png" alt="Browse Videos" className="h-[55px] max-w-[275px] object-contain" />
          <p className="text-sm text-white/70">
            {filteredVideos.length} videos found
            {totalPages > 1 && ` • Page ${page} of ${totalPages}`}
          </p>
        </div>

        {/* Filters Row */}
        <form onSubmit={handleSearch} className="mt-5 grid grid-cols-2 md:grid-cols-12 gap-3">
          <div className="col-span-2 md:col-span-5">
            <label className="block text-xs text-white/70 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white placeholder:text-white/40 text-sm"
              placeholder="Search titles, tags…"
            />
          </div>

          <div className="col-span-1 md:col-span-3">
            <label className="block text-xs text-white/70 mb-1">Collections</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white text-sm"
            >
              <option value="all">All</option>
              <option value="blowjob">Blowjob</option>
              <option value="threesome">Threesome</option>
              <option value="for-women">For Women</option>
              <option value="anal">Anal</option>
            </select>
          </div>

          <div className="col-span-1 md:col-span-2">
            <label className="block text-xs text-white/70 mb-1">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white text-sm"
            >
              <option value="any">Any</option>
              <option value="short">0–10 min</option>
              <option value="mid">10–30 min</option>
              <option value="long">30+ min</option>
            </select>
          </div>

          <div className="col-span-2 md:col-span-2">
            <label className="block text-xs text-white/70 mb-1">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white text-sm"
            >
              <option value="rank">Rank</option>
              <option value="new">Newest</option>
              <option value="top">Most Viewed</option>
              <option value="duration">Duration</option>
            </select>
          </div>
        </form>
      </section>

      {/* Results grid */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold neon-text">
            {search || category !== "all" || duration !== "any" ? "Search Results" : "All Videos"}
          </h2>
          <span className="text-sm text-white/60">
            Showing {startIndex + 1}–{Math.min(endIndex, filteredVideos.length)} of {filteredVideos.length} videos
          </span>
        </div>

        {filteredVideos.length === 0 ? (
          <div className="mt-6 text-center py-12 text-white/50">
            No videos found matching your search.
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
            {paginatedVideos.map((v) => {
              const isFree = freeSlugs.includes(v.viewkey);
              const hasUnlocked = localUnlockedSlugs.includes(v.viewkey);
              // Video is locked unless it's free OR user has unlocked it
              const isLocked = !isFree && !hasUnlocked;

              if (isLocked) {
                return (
                  <div
                    key={v.viewkey}
                    className="neon-border rounded-2xl bg-black/30 overflow-hidden relative group"
                  >
                    <div className="relative aspect-video bg-black/60">
                      {v.primary_thumb ? (
                        <img
                          src={v.primary_thumb}
                          alt="Locked video"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30">
                          No Thumbnail
                        </div>
                      )}
                      {/* Lock overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                        <span className="text-3xl">🔒</span>
                        {isAuthed ? (
                          <button
                            onClick={() => setUnlockModal({ videoId: v.viewkey, title: v.title })}
                            className="mt-2 px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold transition"
                          >
                            Unlock
                          </button>
                        ) : (
                          <Link
                            href="/login/diamond"
                            className="mt-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold transition border border-white/20"
                          >
                            Login to Unlock
                          </Link>
                        )}
                      </div>
                      {/* Rank badge if has rank */}
                      {v.rank != null && (
                        <div
                          className="absolute top-1 left-1 md:top-1.5 md:left-1.5 min-w-[20px] md:min-w-[22px] h-5 flex items-center justify-center text-[10px] md:text-xs font-bold px-1 md:px-1.5 rounded-md bg-gradient-to-br from-purple-500/40 to-pink-500/40 text-white backdrop-blur-sm shadow-md"
                          style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}
                        >
                          #{v.rank}
                        </div>
                      )}
                      <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs text-white">
                        {formatDuration(v.duration)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1 text-[10px] md:text-xs text-white/70 bg-black/30">
                      <span>{formatDuration(v.duration)}</span>
                      <span>{formatViews(v.views)} views</span>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={v.viewkey}
                  href={`/videos/${v.viewkey}`}
                  className="neon-border rounded-2xl bg-black/30 overflow-hidden hover:bg-white/5 transition group"
                >
                  <div className="relative aspect-video bg-black/60">
                    {v.primary_thumb ? (
                      <img
                        src={v.primary_thumb}
                        alt={v.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30">
                        No Thumbnail
                      </div>
                    )}
                    {/* Rank Badge */}
                    {v.rank != null && (
                      <div
                        className="absolute top-1 left-1 md:top-1.5 md:left-1.5 min-w-[20px] md:min-w-[22px] h-5 flex items-center justify-center text-[10px] md:text-xs font-bold px-1 md:px-1.5 rounded-md bg-gradient-to-br from-purple-500/40 to-pink-500/40 text-white backdrop-blur-sm shadow-md"
                        style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}
                      >
                        #{v.rank}
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs text-white">
                      {formatDuration(v.duration)}
                    </div>
                    {v.favorite === 1 && (
                      <div className="absolute top-1 right-1 md:top-2 md:right-2 bg-yellow-500/80 px-2 py-0.5 rounded text-xs text-black font-semibold">
                        ★
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between px-2 py-1 text-[10px] md:text-xs text-white/70 bg-black/30">
                    <span>{formatDuration(v.duration)}</span>
                    <span>{formatViews(v.views)} views</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center items-center gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white/70 hover:bg-white/10 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>

            <div className="flex gap-1">
              {getPageNumbers().map((p, i) => (
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-3 py-2 text-white/50">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(p as number)}
                    className={`px-3 py-2 rounded-lg transition ${
                      page === p
                        ? "bg-pink-500/30 border border-pink-400/50 text-pink-200 font-semibold"
                        : "bg-black/40 border border-white/20 text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                )
              ))}
            </div>

            <button
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white/70 hover:bg-white/10 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </section>

      {/* Unlock Confirmation Modal */}
      {unlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Unlock Video</h3>
              <button
                onClick={() => {
                  setUnlockModal(null);
                  setUnlockError(null);
                }}
                className="text-white/60 hover:text-white text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>

              <p className="text-lg text-white mb-2">
                Unlock this video for
              </p>
              <p className="text-3xl font-bold text-yellow-400 mb-4">
                {nextCost} Credits
              </p>

              <div className="bg-black/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-white/70">Your balance:</p>
                <p className={`text-xl font-bold ${canAfford ? "text-green-400" : "text-red-400"}`}>
                  {localCredits} Credits
                </p>
                {!canAfford && (
                  <p className="text-xs text-red-400 mt-1">
                    You need {nextCost - localCredits} more credits
                  </p>
                )}
              </div>

              {unlockError && (
                <p className="text-sm text-red-400 mb-4">
                  {unlockError === "insufficient_credits" && "Not enough credits"}
                  {unlockError === "no_credit_account" && "No credit account found"}
                  {unlockError === "already_unlocked" && "Already unlocked!"}
                  {unlockError === "not_found" && "Video not found"}
                  {unlockError === "network_error" && "Network error - try again"}
                  {!["insufficient_credits", "no_credit_account", "already_unlocked", "not_found", "network_error"].includes(unlockError) && unlockError}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setUnlockModal(null);
                  setUnlockError(null);
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUnlock(unlockModal.videoId)}
                disabled={isUnlocking || !canAfford}
                className="flex-1 px-4 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-black font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUnlocking ? "Unlocking..." : "Confirm Unlock"}
              </button>
            </div>

            <p className="text-xs text-white/50 text-center mt-4">
              Want to unlock new videos faster? Go to{" "}
              <a href="/swap" className="text-cyan-400 hover:text-cyan-300 underline">
                Swap
              </a>{" "}
              to get XESS tokens to hold in your wallet and earn special credits!
            </p>
          </div>
        </div>
      )}
    </>
  );
}
