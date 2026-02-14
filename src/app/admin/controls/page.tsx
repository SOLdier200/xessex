"use client";

import { useState } from "react";
import Link from "next/link";
import SystemActionsPanel from "./SystemActionsPanel";
import HonestModeratorsPanel from "./HonestModeratorsPanel";

export default function AdminControlsPage() {
  const [siteViews, setSiteViews] = useState<string | null>(null);
  const [showSiteStats, setShowSiteStats] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);

  const fetchSiteStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/admin/site-stats");
      const data = await res.json();
      setSiteViews(data.pageViews);
    } catch (err) {
      console.error("Failed to fetch site stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const toggleSiteStats = () => {
    if (!showSiteStats && siteViews === null) {
      fetchSiteStats();
    }
    setShowSiteStats(!showSiteStats);
  };

  return (
    <main className="min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold neon-text">Admin Controls</h1>
          <p className="text-white/60 text-sm mt-1">Site management and analytics</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin"
            className="px-4 py-2 rounded-full border border-pink-400/50 bg-pink-500/20 text-white text-sm font-semibold hover:bg-pink-500/30 transition"
          >
            Back to Video Selector
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-full border border-white/30 bg-black/40 text-white text-sm font-semibold hover:bg-white/10 transition"
          >
            Back to Site
          </Link>
        </div>
      </div>

      {/* Control Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Site Stats Card */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Site Stats</h2>
              <p className="text-sm text-white/60">View site analytics</p>
            </div>
          </div>
          <button
            onClick={toggleSiteStats}
            className="w-full px-4 py-3 rounded-xl border border-cyan-400/50 bg-cyan-500/20 text-cyan-300 font-semibold hover:bg-cyan-500/30 transition"
          >
            {showSiteStats ? "Hide Stats" : "View Stats"}
          </button>
        </div>

        {/* User Management Card */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/50 flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">User Management</h2>
              <p className="text-sm text-white/60">View users, stats, manage roles</p>
            </div>
          </div>
          <Link
            href="/admin/users"
            className="block w-full px-4 py-3 rounded-xl border border-blue-400/50 bg-blue-500/20 text-blue-300 font-semibold hover:bg-blue-500/30 transition text-center"
          >
            Manage Users
          </Link>
        </div>

        {/* Source Grades Audit Card */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-400/50 flex items-center justify-center">
              <span className="text-2xl">📝</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Source Grades Audit</h2>
              <p className="text-sm text-white/60">Review comment source grades</p>
            </div>
          </div>
          <Link
            href="/admin/audit/source-grades"
            className="block w-full px-4 py-3 rounded-xl border border-purple-400/50 bg-purple-500/20 text-purple-300 font-semibold hover:bg-purple-500/30 transition text-center"
          >
            Open Audit
          </Link>
        </div>

        {/* Manage Rewards Card */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-fuchsia-500/20 border border-fuchsia-400/50 flex items-center justify-center">
              <span className="text-2xl">🎁</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Manage Rewards</h2>
              <p className="text-sm text-white/60">Thresholds, pools, voter rewards</p>
            </div>
          </div>
          <Link
            href="/admin/rewards"
            className="block w-full px-4 py-3 rounded-xl border border-fuchsia-400/50 bg-fuchsia-500/20 text-fuchsia-200 font-semibold hover:bg-fuchsia-500/30 transition text-center"
          >
            Open Rewards
          </Link>
        </div>

        {/* Payout Pipeline Card */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-400/50 flex items-center justify-center">
              <span className="text-2xl">⚡</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Payout Pipeline</h2>
              <p className="text-sm text-white/60">Weekly distribute → claims flow</p>
            </div>
          </div>
          <Link
            href="/admin/payout-pipeline"
            className="block w-full px-4 py-3 rounded-xl border border-orange-400/50 bg-orange-500/20 text-orange-200 font-semibold hover:bg-orange-500/30 transition text-center"
          >
            Open Pipeline
          </Link>
        </div>

        {/* Honest Moderators Card */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center">
              <span className="text-2xl">🔍</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Honest Moderators</h2>
              <p className="text-sm text-white/60">Flag biased mod voting patterns</p>
            </div>
          </div>
          <a
            href="#honest-moderators"
            className="block w-full px-4 py-3 rounded-xl border border-rose-400/50 bg-rose-500/20 text-rose-300 font-semibold hover:bg-rose-500/30 transition text-center"
          >
            Review Flags
          </a>
        </div>

        {/* Video Unlocks Card */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 border border-yellow-400/50 flex items-center justify-center">
              <span className="text-2xl">🔓</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Video Unlocks</h2>
              <p className="text-sm text-white/60">Audit unlocks: user, video, cost, time</p>
            </div>
          </div>
          <Link
            href="/admin/unlocks"
            className="block w-full px-4 py-3 rounded-xl border border-yellow-400/50 bg-yellow-500/20 text-yellow-200 font-semibold hover:bg-yellow-500/30 transition text-center"
          >
            View Unlocks
          </Link>
        </div>

        {/* Unlock Analytics Card */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center">
              <span className="text-2xl">📈</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Unlock Analytics</h2>
              <p className="text-sm text-white/60">Funnel + spend overview</p>
            </div>
          </div>
          <Link
            href="/admin/analytics/unlocks"
            className="block w-full px-4 py-3 rounded-xl border border-emerald-400/50 bg-emerald-500/20 text-emerald-200 font-semibold hover:bg-emerald-500/30 transition text-center"
          >
            View Analytics
          </Link>
        </div>

        {/* Unruly Users Card */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-400/50 flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Unruly Users</h2>
              <p className="text-sm text-white/60">Comment/dislike spammers, banned users</p>
            </div>
          </div>
          <Link
            href="/admin/unruly-users"
            className="block w-full px-4 py-3 rounded-xl border border-orange-400/50 bg-orange-500/20 text-orange-200 font-semibold hover:bg-orange-500/30 transition text-center"
          >
            Review Users
          </Link>
        </div>

        {/* Mod Actions Audit Card */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/50 flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Mod Actions Audit</h2>
              <p className="text-sm text-white/60">Review all moderator actions</p>
            </div>
          </div>
          <Link
            href="/admin/mod-actions"
            className="block w-full px-4 py-3 rounded-xl border border-indigo-400/50 bg-indigo-500/20 text-indigo-200 font-semibold hover:bg-indigo-500/30 transition text-center"
          >
            View Actions
          </Link>
        </div>

        {/* Credit Accrual History Card */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-lime-500/20 border border-lime-400/50 flex items-center justify-center">
              <span className="text-2xl">💎</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Credit Accrual History</h2>
              <p className="text-sm text-white/60">View all credit accruals per user</p>
            </div>
          </div>
          <Link
            href="/admin/credit-history"
            className="block w-full px-4 py-3 rounded-xl border border-lime-400/50 bg-lime-500/20 text-lime-200 font-semibold hover:bg-lime-500/30 transition text-center"
          >
            View Credit History
          </Link>
        </div>

        {/* XESS Token Payment History Card */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center">
              <span className="text-2xl">🧾</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">XESS Token Payments</h2>
              <p className="text-sm text-white/60">Twice-weekly payout history per user</p>
            </div>
          </div>
          <Link
            href="/admin/xess-payments"
            className="block w-full px-4 py-3 rounded-xl border border-amber-400/50 bg-amber-500/20 text-amber-200 font-semibold hover:bg-amber-500/30 transition text-center"
          >
            View Payments
          </Link>
        </div>

        {/* Wallet Whitelist Card */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-400/50 flex items-center justify-center">
              <span className="text-2xl">🛡️</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Wallet Whitelist</h2>
              <p className="text-sm text-white/60">Approve wallets for private sale</p>
            </div>
          </div>
          <Link
            href="/admin/whitelist"
            className="block w-full px-4 py-3 rounded-xl border border-teal-400/50 bg-teal-500/20 text-teal-200 font-semibold hover:bg-teal-500/30 transition text-center"
          >
            Manage Whitelist
          </Link>
        </div>
      </div>

      {/* Site Stats Panel */}
      {showSiteStats && (
        <div className="neon-border rounded-2xl p-6 bg-black/30 border-cyan-400/50">
          <h3 className="text-xl font-semibold text-cyan-400 mb-4">Site Statistics</h3>
          {loadingStats ? (
            <div className="text-white/60">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="rounded-xl p-4 bg-black/40 border border-cyan-400/30">
                <div className="text-3xl font-bold text-white">
                  {siteViews === null ? "..." : Number(siteViews).toLocaleString()}
                </div>
                <div className="text-sm text-white/60">Total Page Views</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <HonestModeratorsPanel />
      </div>

      <SystemActionsPanel />
    </main>
  );
}
