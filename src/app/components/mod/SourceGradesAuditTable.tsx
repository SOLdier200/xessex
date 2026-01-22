"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type SourceGradeRow = {
  id: string;
  createdAt: string;
  direction: number;
  video: { id: string; slug: string; title: string };
  comment: { id: string; createdAt: string; preview: string };
  mod: { id: string; role: string; display: string };
  author: { id: string; display: string };
};

type ApiResponse = {
  ok: boolean;
  rows: SourceGradeRow[];
  nextCursor: string | null;
  meta: { limit: number; filters: Record<string, string | null> };
};

export default function SourceGradesAuditTable() {
  const [rows, setRows] = useState<SourceGradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Filters
  const [videoId, setVideoId] = useState("");
  const [modId, setModId] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [commentId, setCommentId] = useState("");

  const fetchData = useCallback(
    async (cursor: string | null = null, append = false) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (cursor) params.set("cursor", cursor);
      if (videoId.trim()) params.set("videoId", videoId.trim());
      if (modId.trim()) params.set("modId", modId.trim());
      if (authorId.trim()) params.set("authorId", authorId.trim());
      if (commentId.trim()) params.set("commentId", commentId.trim());

      const res = await fetch(`/api/mod/audit/source-grades?${params}`);
      const data: ApiResponse = await res.json();

      if (data.ok) {
        setRows((prev) => (append ? [...prev, ...data.rows] : data.rows));
        setNextCursor(data.nextCursor);
      }
      setLoading(false);
    },
    [videoId, modId, authorId, commentId]
  );

  useEffect(() => {
    fetchData(null, false);
  }, [fetchData]);

  const handleFilter = () => {
    fetchData(null, false);
  };

  const loadMore = () => {
    if (nextCursor) {
      fetchData(nextCursor, true);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="neon-border rounded-xl p-4 bg-black/30">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-white/70 mb-1">Video ID</label>
            <input
              type="text"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              placeholder="Filter by video..."
              className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white placeholder:text-white/40 text-sm"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-white/70 mb-1">Mod ID</label>
            <input
              type="text"
              value={modId}
              onChange={(e) => setModId(e.target.value)}
              placeholder="Filter by mod..."
              className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white placeholder:text-white/40 text-sm"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-white/70 mb-1">Author ID</label>
            <input
              type="text"
              value={authorId}
              onChange={(e) => setAuthorId(e.target.value)}
              placeholder="Filter by author..."
              className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white placeholder:text-white/40 text-sm"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-white/70 mb-1">Comment ID</label>
            <input
              type="text"
              value={commentId}
              onChange={(e) => setCommentId(e.target.value)}
              placeholder="Filter by comment..."
              className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white placeholder:text-white/40 text-sm"
            />
          </div>
          <button
            onClick={handleFilter}
            className="px-4 py-2 rounded-xl bg-pink-500/30 text-pink-300 border border-pink-400 font-semibold hover:bg-pink-500/40 transition"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="neon-border rounded-xl bg-black/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pink-400/30 bg-black/40">
                <th className="px-4 py-3 text-left text-white/70 font-medium">Date</th>
                <th className="px-4 py-3 text-left text-white/70 font-medium">Dir</th>
                <th className="px-4 py-3 text-left text-white/70 font-medium">Video</th>
                <th className="px-4 py-3 text-left text-white/70 font-medium">Comment</th>
                <th className="px-4 py-3 text-left text-white/70 font-medium">Mod</th>
                <th className="px-4 py-3 text-left text-white/70 font-medium">Author</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/50">
                    No source grades found
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3 text-white/80 whitespace-nowrap">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        row.direction === 1
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/50"
                          : "bg-red-500/20 text-red-300 border border-red-400/50"
                      }`}
                    >
                      {row.direction === 1 ? "+1" : "-1"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/videos/${row.video.slug}`}
                      className="text-pink-300 hover:text-pink-200 underline"
                    >
                      {row.video.title.length > 30
                        ? row.video.title.slice(0, 30) + "..."
                        : row.video.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white/70 max-w-[200px] truncate">
                    {row.comment.preview}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs ${
                        row.mod.role === "ADMIN"
                          ? "text-yellow-300"
                          : row.mod.role === "MOD"
                          ? "text-purple-300"
                          : "text-white/70"
                      }`}
                    >
                      {row.mod.display}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs">{row.author.display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="px-4 py-8 text-center text-white/50">Loading...</div>
        )}

        {nextCursor && !loading && (
          <div className="px-4 py-4 border-t border-white/10 text-center">
            <button
              onClick={loadMore}
              className="px-4 py-2 rounded-xl bg-purple-500/30 text-purple-300 border border-purple-400 font-semibold hover:bg-purple-500/40 transition"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
