"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type FunnelRow = { event: string; count: number };

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs opacity-70">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

export default function AdminUnlockAnalyticsPage() {
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<FunnelRow[]>([]);
  const [creditsSpent, setCreditsSpent] = useState<number>(0);
  const [avgCost, setAvgCost] = useState<number>(0);
  const [unlocks, setUnlocks] = useState<number>(0);

  const query = useMemo(() => `days=${days}`, [days]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/analytics/unlock-funnel?${query}`, { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (!json.ok) throw new Error(json.error || "failed");

        setRows(json.rows || []);
        setCreditsSpent(json.creditsSpent || 0);
        setAvgCost(json.avgCost || 0);
        setUnlocks(json.unlocks || 0);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "error";
        setErr(msg);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [query]);

  const map = useMemo(() => new Map(rows.map(r => [r.event, r.count])), [rows]);
  const impressions = map.get("LOCKED_IMPRESSION") ?? 0;
  const clicks = map.get("UNLOCK_CLICK") ?? 0;
  const success = map.get("UNLOCK_SUCCESS") ?? 0;

  const clickRate = impressions > 0 ? (clicks / impressions) : 0;
  const successRate = clicks > 0 ? (success / clicks) : 0;

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/admin/controls" className="text-white/60 hover:text-white">
              &larr; Admin
            </Link>
            <h1 className="text-xl font-semibold">Unlock Analytics</h1>
          </div>
          <div className="text-sm opacity-70">Funnel + spend overview.</div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm opacity-70">Window</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
          >
            <option value={7}>7d</option>
            <option value={14}>14d</option>
            <option value={30}>30d</option>
            <option value={60}>60d</option>
            <option value={90}>90d</option>
          </select>
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm">{err}</div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Unlocks" value={String(unlocks)} />
        <StatCard title="Credits spent" value={String(Math.round(creditsSpent))} />
        <StatCard title="Avg cost" value={avgCost ? avgCost.toFixed(1) : "0"} />
        <StatCard title="Click -> Success" value={`${(successRate * 100).toFixed(1)}%`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard title="Locked impressions" value={String(impressions)} />
        <StatCard title="Impression -> Click" value={`${(clickRate * 100).toFixed(1)}%`} />
      </div>

      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <div className="bg-white/5 px-4 py-3 font-semibold text-sm">Event counts</div>
        <div className="p-4 space-y-2">
          {loading ? (
            <div className="opacity-70 text-sm">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="opacity-70 text-sm">No data</div>
          ) : (
            rows.map((r) => (
              <div key={r.event} className="flex items-center justify-between text-sm">
                <span className="opacity-80">{r.event}</span>
                <span className="font-semibold">{r.count}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
