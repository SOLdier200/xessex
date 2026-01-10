"use client";

import { useState, useMemo } from "react";
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
}

export default function VideoSearch({ videos }: VideoSearchProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [duration, setDuration] = useState("any");
  const [sort, setSort] = useState("new");

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
    if (sort === "top") {
      result.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (sort === "duration") {
      result.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    }
    // "new" keeps original order (already sorted by newest from data source)

    return result;
  }, [videos, search, category, duration, sort]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is already reactive via useMemo
  };

  return (
    <>
      <section className="neon-border rounded-2xl p-4 md:p-6 bg-black/30">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold neon-text">Browse Videos</h1>
          <p className="text-sm text-white/70">
            {filteredVideos.length} of {videos.length} videos
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
              <option value="new">Newest</option>
              <option value="top">Top rated</option>
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
          <span className="text-sm text-white/60">{filteredVideos.length} videos</span>
        </div>

        {filteredVideos.length === 0 ? (
          <div className="mt-6 text-center py-12 text-white/50">
            No videos found matching your search.
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {filteredVideos.map((v) => (
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
                  <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs text-white">
                    {formatDuration(v.duration)}
                  </div>
                  {v.favorite === 1 && (
                    <div className="absolute top-2 left-2 bg-yellow-500/80 px-2 py-0.5 rounded text-xs text-black font-semibold">
                      ★
                    </div>
                  )}
                </div>

                <div className="p-2 md:p-3">
                  <div className="font-semibold text-white text-xs md:text-sm line-clamp-2 group-hover:text-pink-300 transition">
                    {v.title}
                  </div>
                  <div className="mt-1 md:mt-2 text-[10px] md:text-xs text-white/60 truncate">
                    {v.performers || "Unknown"}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] md:text-xs text-white/50">
                    <span>{formatViews(v.views)} views</span>
                    <span className="truncate ml-1">{v.categories?.split(";")[0]}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
