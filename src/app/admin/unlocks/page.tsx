"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Row = {
  createdAt: string;
  cost: number;
  userId: string;
  videoId: string;
  user: {
    memberId: string;
    walletAddress: string | null;
    
    role: "USER" | "MOD" | "ADMIN";
    createdAt: string;
  };
  video: {
    title: string;
    slug: string;
    rank: number | null;
  };
};

export default function AdminUnlocksPage() {
  const [q, setQ] = useState("");
  const [take, setTake] = useState(50);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Row[]>([]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    p.set("take", String(take));
    p.set("skip", String(skip));
    return p.toString();
  }, [q, take, skip]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/unlocks?${query}`, { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (!json.ok) throw new Error(json.error || "failed");
        setItems(json.items);
        setTotal(json.total);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "error";
        setErr(msg);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [query]);

  const page = Math.floor(skip / take) + 1;
  const pages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/admin/controls" className="text-white/60 hover:text-white">
              &larr; Admin
            </Link>
            <h1 className="text-xl font-semibold">Video Unlocks</h1>
          </div>
          <div className="text-sm opacity-70">
            Audit who unlocked what, when, and cost (credits).
          </div>
        </div>
        <div className="text-sm opacity-70">
          Total: <span className="font-semibold opacity-100">{total}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => {
            setSkip(0);
            setQ(e.target.value);
          }}
          placeholder="Search: userId, memberId, wallet, slug, title..."
          className="w-full sm:w-[420px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
        />
        <select
          value={take}
          onChange={(e) => {
            setSkip(0);
            setTake(Number(e.target.value));
          }}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>

        <button
          onClick={() => setSkip(Math.max(0, skip - take))}
          disabled={skip === 0 || loading}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 disabled:opacity-40"
        >
          Prev
        </button>
        <button
          onClick={() => setSkip(Math.min((pages - 1) * take, skip + take))}
          disabled={page >= pages || loading}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 disabled:opacity-40"
        >
          Next
        </button>

        <div className="text-sm opacity-70">
          Page <span className="font-semibold opacity-100">{page}</span> / {pages}
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm">
          {err}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-left">
              <th className="p-3">Time</th>
              <th className="p-3">Cost</th>
              <th className="p-3">Video</th>
              <th className="p-3">User</th>
              <th className="p-3">Wallet</th>
              <th className="p-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3 opacity-70" colSpan={6}>Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="p-3 opacity-70" colSpan={6}>No results</td></tr>
            ) : (
              items.map((r, i) => (
                <tr key={i} className="border-t border-white/10">
                  <td className="p-3 opacity-80">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="p-3 font-semibold">{r.cost}</td>
                  <td className="p-3">
                    <div className="font-semibold">{r.video.title}</div>
                    <div className="text-xs opacity-70">/{r.video.slug}{r.video.rank ? ` • rank ${r.video.rank}` : ""}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-semibold">{r.user.memberId}</div>
                    <div className="text-xs opacity-70">{r.userId}</div>
                  </td>
                  <td className="p-3 text-xs opacity-80">
                    <div>auth: {r.user.walletAddress ?? "-"}</div>
                    
                  </td>
                  <td className="p-3">{r.user.role}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
