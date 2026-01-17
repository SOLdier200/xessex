"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AdminConfig = {
  minWeeklyScoreThreshold: number;
  minMvmThreshold: number;
  allTimeLikesBpsOfLikes: number;
  memberVoterBpsOfLikes: number;
  voterRewardPerVoteAtomic: string;
};

export default function AdminRewardsClient() {
  const [cfg, setCfg] = useState<AdminConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setMsg(null);
    const r = await fetch("/api/admin/config", { cache: "no-store" });
    const j = await r.json();
    if (!j.ok) {
      setMsg(j.error || "Failed to load config");
      return;
    }
    const c = j.config;
    setCfg({
      minWeeklyScoreThreshold: c.minWeeklyScoreThreshold,
      minMvmThreshold: c.minMvmThreshold,
      allTimeLikesBpsOfLikes: c.allTimeLikesBpsOfLikes,
      memberVoterBpsOfLikes: c.memberVoterBpsOfLikes,
      voterRewardPerVoteAtomic: String(c.voterRewardPerVoteAtomic ?? "0"),
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setMsg(null);
    const r = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...cfg,
        voterRewardPerVoteAtomic: cfg.voterRewardPerVoteAtomic,
      }),
    });
    const j = await r.json();
    setSaving(false);
    if (!j.ok) {
      setMsg(j.error || "Save failed");
      return;
    }
    setMsg("Saved.");
    await load();
  }

  if (!cfg) {
    return (
      <div className="p-6 text-white">
        <div className="text-white/70">Loading rewards config...</div>
        {msg && <div className="mt-3 text-red-400">{msg}</div>}
      </div>
    );
  }

  // Calculate weekly diamond slice (remainder after all-time + voter)
  const weeklyDiamondBps = 10000 - cfg.allTimeLikesBpsOfLikes - cfg.memberVoterBpsOfLikes;

  return (
    <div className="p-6 text-white max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/controls"
          className="text-white/60 hover:text-white transition-colors"
        >
          ← Back to Controls
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">Rewards Settings</h1>
      <p className="text-white/60 mb-6">
        Adjust thresholds and pool slices live. Changes affect the next weekly distribute run.
      </p>

      <div className="space-y-5">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
          <h2 className="font-semibold mb-4">Thresholds</h2>

          <label className="block text-sm text-white/70 mb-2">
            Min Weekly Score Threshold (Top 50 eligibility)
          </label>
          <input
            className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-white"
            type="number"
            value={cfg.minWeeklyScoreThreshold}
            onChange={(e) => setCfg({ ...cfg, minWeeklyScoreThreshold: Number(e.target.value) })}
          />

          <label className="block text-sm text-white/70 mt-4 mb-2">
            Min MVM Threshold (MVM pool eligibility)
          </label>
          <input
            className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-white"
            type="number"
            value={cfg.minMvmThreshold}
            onChange={(e) => setCfg({ ...cfg, minMvmThreshold: Number(e.target.value) })}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
          <h2 className="font-semibold mb-4">Likes Pool Slices</h2>
          <p className="text-xs text-white/50 mb-4">
            The Likes Pool (75% of weekly emission) is split between Weekly Diamond, All-Time, and Member Voter rewards.
            Weekly Diamond gets the remainder after All-Time and Member Voter slices.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-white/50 text-xs mb-1">Weekly Diamond</div>
              <div className="text-lg font-mono">{(weeklyDiamondBps / 100).toFixed(1)}%</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-white/50 text-xs mb-1">All-Time</div>
              <div className="text-lg font-mono">{(cfg.allTimeLikesBpsOfLikes / 100).toFixed(1)}%</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-white/50 text-xs mb-1">Member Voter</div>
              <div className="text-lg font-mono">{(cfg.memberVoterBpsOfLikes / 100).toFixed(1)}%</div>
            </div>
          </div>

          <label className="block text-sm text-white/70 mb-2">
            All-Time Likes Slice (bps of Likes pool) — 1000 = 10%
          </label>
          <input
            className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-white"
            type="number"
            value={cfg.allTimeLikesBpsOfLikes}
            onChange={(e) => setCfg({ ...cfg, allTimeLikesBpsOfLikes: Number(e.target.value) })}
          />

          <label className="block text-sm text-white/70 mt-4 mb-2">
            Member Voter Slice (bps of Likes pool) — 500 = 5%
          </label>
          <input
            className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-white"
            type="number"
            value={cfg.memberVoterBpsOfLikes}
            onChange={(e) => setCfg({ ...cfg, memberVoterBpsOfLikes: Number(e.target.value) })}
          />

          {cfg.allTimeLikesBpsOfLikes + cfg.memberVoterBpsOfLikes > 10000 && (
            <div className="mt-2 text-red-400 text-sm">
              Warning: Slices exceed 100% of likes pool
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
          <h2 className="font-semibold mb-4">Member Voter Rewards</h2>

          <label className="block text-sm text-white/70 mb-2">
            Reward per vote (atomic XESS units, BigInt string)
          </label>
          <input
            className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-white font-mono"
            type="text"
            value={cfg.voterRewardPerVoteAtomic}
            onChange={(e) => setCfg({ ...cfg, voterRewardPerVoteAtomic: e.target.value })}
          />

          <p className="text-xs text-white/50 mt-2">
            Set to 0 to use pool-based distribution instead of per-vote rewards.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/15 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={load}
            disabled={saving}
            className="rounded-xl px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            Reset
          </button>
        </div>

        {msg && (
          <div className={msg === "Saved." ? "text-green-400" : "text-red-400"}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
