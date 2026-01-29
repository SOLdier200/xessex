"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";

type WeekInfo = {
  weekKey: string;
  weekIndex: number;
  batchExists: boolean;
};

type WeekData = {
  thisWeek: WeekInfo;
  lastWeek: WeekInfo;
};

type EpochStatus = {
  pendingWeekKey: string | null;
  pendingEpochBuilt: boolean;
  pendingEpochSetOnChain: boolean;
  latestEpoch: {
    epoch: number;
    weekKey: string;
    rootHex: string;
    totalAtomic: string;
    leafCount: number;
    setOnChain: boolean;
    onChainTxSig: string | null;
    createdAt: string;
    version?: number;
  } | null;
};

type DistributeResult = {
  ok: boolean;
  error?: string;
  message?: string;
  weekKey?: string;
  weekIndex?: number;
  sourceWeekKey?: string;
  payoutWeekKey?: string;
  detail?: {
    emission?: string;
    totalUsers?: number;
    totalRewards?: number;
    totalAmount?: string;
    batchId?: string;
    nextStep?: string;
  };
};

type BuildEpochResult = {
  ok: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
  weekKey?: string;
  epoch?: number;
  rootHex?: string;
  leafCount?: number;
  totalAtomic?: string;
  version?: number;
  buildHash?: string;
  nextStep?: string;
};

type MarkOnChainResult = {
  ok: boolean;
  error?: string;
  epoch?: number;
  txSig?: string;
};

type ResetResult = {
  ok: boolean;
  error?: string;
  weekKey?: string;
  deleted?: {
    leaves: number;
    epochs: number;
    events: number;
    batches: number;
  };
};

export default function PayoutPipelinePage() {
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [epochStatusV2, setEpochStatusV2] = useState<EpochStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Selected week
  const [selectedWeek, setSelectedWeek] = useState<"this" | "last">("last");

  // Step 1: Weekly Distribute
  const [distributeResult, setDistributeResult] = useState<DistributeResult | null>(null);
  const [makeupResult, setMakeupResult] = useState<DistributeResult | null>(null);
  const [makeupSourceWeek, setMakeupSourceWeek] = useState("");
  const [makeupPayoutWeek, setMakeupPayoutWeek] = useState("");
  const [makeupForce, setMakeupForce] = useState(false);

  // Step 2: Build Epoch
  const [buildResult, setBuildResult] = useState<BuildEpochResult | null>(null);

  // Step 3: Mark On-Chain
  const [markEpoch, setMarkEpoch] = useState("");
  const [markTxSig, setMarkTxSig] = useState("");
  const [markResult, setMarkResult] = useState<MarkOnChainResult | null>(null);

  // Dev tools
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);
  const [showDevTools, setShowDevTools] = useState(false);

  const [running, setRunning] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [weekRes, epochResV2] = await Promise.all([
        fetch("/api/admin/recompute-rewards-epoch", { method: "GET" }),
        fetch("/api/admin/build-claim-epoch-v2", { method: "GET" }),
      ]);

      const weekJson = await weekRes.json();
      const epochJsonV2 = await epochResV2.json();

      if (weekJson.ok) {
        setWeekData(weekJson);
      }
      if (epochJsonV2.ok) {
        setEpochStatusV2(epochJsonV2);
        // Pre-fill mark epoch if empty and latest is not on-chain
        if (epochJsonV2.latestEpoch && !epochJsonV2.latestEpoch.setOnChain) {
          setMarkEpoch((prev) => prev || String(epochJsonV2.latestEpoch.epoch));
        }
      }
    } catch {
      // Ignore errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (weekData) {
      if (!makeupSourceWeek) setMakeupSourceWeek(weekData.lastWeek.weekKey);
      if (!makeupPayoutWeek) setMakeupPayoutWeek(addDaysUTC(weekData.thisWeek.weekKey, 7));
    }
  }, [weekData, makeupSourceWeek, makeupPayoutWeek]);

  const currentWeekInfo = weekData
    ? selectedWeek === "this"
      ? weekData.thisWeek
      : weekData.lastWeek
    : null;

  // Step 1: Run Weekly Distribute
  async function runDistribute(force = false) {
    if (!currentWeekInfo) return;
    setRunning("distribute");
    setDistributeResult(null);

    const toastId = toast.loading("Running weekly distribute...", {
      description: `Processing week ${currentWeekInfo.weekKey}`,
    });

    try {
      const r = await fetch("/api/admin/recompute-rewards-epoch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekKey: currentWeekInfo.weekKey,
          force,
        }),
      });
      const j = await r.json();
      setDistributeResult(j);

      if (j.ok) {
        toast.success("Weekly distribute complete!", {
          id: toastId,
          description: `Created ${j.rewardCount || 0} rewards for ${j.userCount || 0} users`,
        });
      } else {
        toast.error("Weekly distribute failed", {
          id: toastId,
          description: j.error || "Unknown error",
        });
      }
    } catch (e) {
      setDistributeResult({ ok: false, error: String(e) });
      toast.error("Weekly distribute failed", {
        id: toastId,
        description: String(e),
      });
    }
    setRunning(null);
    loadData();
  }

  // Makeup payout: source week -> payout week
  async function runMakeupPayout() {
    if (!makeupSourceWeek || !makeupPayoutWeek) return;
    setRunning("makeup");
    setMakeupResult(null);

    const toastId = toast.loading("Running makeup payout...", {
      description: `${makeupSourceWeek} → ${makeupPayoutWeek}`,
    });

    try {
      const r = await fetch("/api/admin/recompute-rewards-epoch-makeup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceWeekKey: makeupSourceWeek,
          payoutWeekKey: makeupPayoutWeek,
          force: makeupForce,
        }),
      });
      const j = await r.json();
      setMakeupResult(j);

      if (j.ok) {
        toast.success("Makeup payout complete!", {
          id: toastId,
          description: `Created ${j.detail?.totalRewards || 0} rewards for ${j.detail?.totalUsers || 0} users`,
        });
      } else {
        toast.error("Makeup payout failed", {
          id: toastId,
          description: j.error || "Unknown error",
        });
      }
    } catch (e) {
      setMakeupResult({ ok: false, error: String(e) });
      toast.error("Makeup payout failed", {
        id: toastId,
        description: String(e),
      });
    }
    setRunning(null);
    loadData();
  }

  // Step 2: Run Build Epoch (all users)
  async function runBuildEpoch() {
    setRunning("build");
    setBuildResult(null);

    const toastId = toast.loading("Building claim epoch...", {
      description: "Generating merkle tree for all users",
    });

    try {
      const r = await fetch("/api/admin/build-claim-epoch-v2", { method: "POST" });
      const j = await r.json();
      setBuildResult(j);
      // Pre-fill mark epoch field
      if (j.ok && j.epoch) {
        setMarkEpoch(String(j.epoch));
        toast.success("Claim epoch built!", {
          id: toastId,
          description: `Epoch ${j.epoch} with ${j.leafCount || 0} leaves`,
        });
      } else {
        toast.error("Build epoch failed", {
          id: toastId,
          description: j.error || "Unknown error",
        });
      }
    } catch (e) {
      setBuildResult({ ok: false, error: String(e) });
      toast.error("Build epoch failed", {
        id: toastId,
        description: String(e),
      });
    }
    setRunning(null);
    loadData();
  }

  // Step 3: Mark On-Chain
  async function runMarkOnChain() {
    if (!markEpoch) return;
    setRunning("mark");
    setMarkResult(null);

    const toastId = toast.loading("Marking epoch on-chain...", {
      description: `Epoch ${markEpoch}`,
    });

    try {
      const r = await fetch("/api/admin/mark-epoch-onchain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          epoch: parseInt(markEpoch, 10),
          txSig: markTxSig || undefined,
        }),
      });
      const j = await r.json();
      setMarkResult(j);

      if (j.ok) {
        toast.success("Epoch marked on-chain!", {
          id: toastId,
          description: `Epoch ${markEpoch} is now claimable`,
        });
      } else {
        toast.error("Mark on-chain failed", {
          id: toastId,
          description: j.error || "Unknown error",
        });
      }
    } catch (e) {
      setMarkResult({ ok: false, error: String(e) });
      toast.error("Mark on-chain failed", {
        id: toastId,
        description: String(e),
      });
    }
    setRunning(null);
    loadData();
  }

  // Dev: Reset week
  async function runResetWeek() {
    if (!currentWeekInfo) return;
    if (!confirm(`Delete ALL data for ${currentWeekInfo.weekKey}? This cannot be undone.`)) {
      return;
    }
    setRunning("reset");
    setResetResult(null);
    try {
      const r = await fetch("/api/admin/reset-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekKey: currentWeekInfo.weekKey }),
      });
      const j = await r.json();
      setResetResult(j);
    } catch (e) {
      setResetResult({ ok: false, error: String(e) });
    }
    setRunning(null);
    setDistributeResult(null);
    setBuildResult(null);
    loadData();
  }

  const latestEpoch = epochStatusV2?.latestEpoch;
  const rootHex = buildResult?.rootHex || latestEpoch?.rootHex || "";
  const epochNum = buildResult?.epoch || latestEpoch?.epoch || 0;

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Payout Pipeline</h1>
          <p className="text-white/60 text-sm mt-1">
            Test and run the weekly rewards → claim flow
          </p>
        </div>
        <Link
          href="/admin/controls"
          className="px-4 py-2 rounded-full border border-white/30 bg-black/40 text-white text-sm font-semibold hover:bg-white/10 transition"
        >
          ← Back to Controls
        </Link>
      </div>

      {/* Current Status Card */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Current Status</h2>
        {loading ? (
          <div className="text-white/50">Loading...</div>
        ) : epochStatusV2 ? (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-white/50 mb-2">All Users (Unified)</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-black/40 rounded-xl p-4">
                  <div className="text-xs text-white/50 mb-1">Pending Week</div>
                  <div className="font-mono text-white">
                    {epochStatusV2?.pendingWeekKey || "none"}
                  </div>
                </div>
                <div className="bg-black/40 rounded-xl p-4">
                  <div className="text-xs text-white/50 mb-1">Epoch Built</div>
                  <div className={epochStatusV2?.pendingEpochBuilt ? "text-green-400" : "text-yellow-400"}>
                    {epochStatusV2?.pendingEpochBuilt ? "Yes" : "No"}
                  </div>
                </div>
                <div className="bg-black/40 rounded-xl p-4">
                  <div className="text-xs text-white/50 mb-1">On-Chain</div>
                  <div className={epochStatusV2?.pendingEpochSetOnChain ? "text-green-400" : "text-yellow-400"}>
                    {epochStatusV2?.pendingEpochSetOnChain ? "Yes" : "No"}
                  </div>
                </div>
                <div className="bg-black/40 rounded-xl p-4">
                  <div className="text-xs text-white/50 mb-1">Latest Epoch</div>
                  <div className="font-mono text-white">
                    {latestEpoch ? `#${latestEpoch.epoch}` : "none"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-white/50">No data</div>
        )}

        {latestEpoch && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-white/50">Week:</span>{" "}
                <span className="font-mono">{latestEpoch.weekKey}</span>
              </div>
              <div>
                <span className="text-white/50">Leaves:</span>{" "}
                <span>{latestEpoch.leafCount}</span>
              </div>
              <div>
                <span className="text-white/50">Total:</span>{" "}
                <span className="font-mono">{formatAtomic(latestEpoch.totalAtomic)} XESS</span>
              </div>
            </div>
            {latestEpoch.rootHex && (
              <div className="mt-3">
                <div className="text-xs text-white/50 mb-1">Root Hash:</div>
                <code className="text-xs bg-black/60 p-2 rounded block break-all text-cyan-400">
                  {latestEpoch.rootHex}
                </code>
              </div>
            )}
            {latestEpoch.onChainTxSig && (
              <div className="mt-2">
                <div className="text-xs text-white/50 mb-1">On-chain TX:</div>
                <a
                  href={`https://explorer.solana.com/tx/${latestEpoch.onChainTxSig}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline break-all"
                >
                  {latestEpoch.onChainTxSig}
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pipeline Steps */}
      <div className="space-y-6">
        {/* Step 1: Weekly Distribute */}
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/50 flex items-center justify-center text-blue-400 font-bold">
              1
            </div>
            <div>
              <h3 className="font-semibold text-white">Weekly Distribute</h3>
              <p className="text-xs text-white/50">
                Calculate payouts and create RewardEvents (status=PAID)
              </p>
            </div>
          </div>

          {/* Week Selection Buttons */}
          <div className="mb-4">
            <div className="text-xs text-white/50 mb-2">Select Week</div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedWeek("last")}
                className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                  selectedWeek === "last"
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-black/40 border-white/10 text-white/70 hover:bg-black/60"
                }`}
              >
                <div className="text-sm font-medium">Last Week</div>
                {weekData && (
                  <div className="text-xs mt-1 opacity-70 font-mono">
                    {weekData.lastWeek.weekKey}
                    {weekData.lastWeek.batchExists && (
                      <span className="ml-2 text-yellow-400">(exists)</span>
                    )}
                  </div>
                )}
              </button>
              <button
                onClick={() => setSelectedWeek("this")}
                className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                  selectedWeek === "this"
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-black/40 border-white/10 text-white/70 hover:bg-black/60"
                }`}
              >
                <div className="text-sm font-medium">This Week</div>
                {weekData && (
                  <div className="text-xs mt-1 opacity-70 font-mono">
                    {weekData.thisWeek.weekKey}
                    {weekData.thisWeek.batchExists && (
                      <span className="ml-2 text-yellow-400">(exists)</span>
                    )}
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Week Info Display */}
          {currentWeekInfo && (
            <div className="bg-black/40 rounded-lg p-3 mb-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-white/50">weekKey:</span>{" "}
                  <span className="font-mono">{currentWeekInfo.weekKey}</span>
                </div>
                <div>
                  <span className="text-white/50">weekIndex:</span>{" "}
                  <span className="font-mono">{currentWeekInfo.weekIndex}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => runDistribute(false)}
              disabled={running !== null || !currentWeekInfo}
              className="px-4 py-2 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 transition-colors text-sm font-medium text-black"
            >
              {running === "distribute" ? "Running..." : "Run Weekly Distribute"}
            </button>
            {currentWeekInfo?.batchExists && (
              <button
                onClick={() => runDistribute(true)}
                disabled={running !== null}
                className="px-4 py-2 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 transition-colors text-sm font-medium text-black"
              >
                Force Rerun
              </button>
            )}
          </div>

          {distributeResult && (
            <div
              className={`mt-4 p-4 rounded-lg text-sm ${
                distributeResult.ok
                  ? "bg-green-900/30 border border-green-500/30"
                  : distributeResult.error === "BATCH_EXISTS"
                  ? "bg-yellow-900/30 border border-yellow-500/30"
                  : "bg-red-900/30 border border-red-500/30"
              }`}
            >
              {distributeResult.ok ? (
                <div>
                  <div className="text-green-400 font-medium mb-2">Success</div>
                  <div className="text-white/70 space-y-1">
                    <div>
                      Users: {distributeResult.detail?.totalUsers} | Rewards: {distributeResult.detail?.totalRewards}
                    </div>
                    <div>Total: {distributeResult.detail?.totalAmount} XESS</div>
                    <div>Emission: {distributeResult.detail?.emission}</div>
                  </div>
                  {distributeResult.detail?.nextStep && (
                    <div className="mt-2 text-yellow-400 text-xs">{distributeResult.detail.nextStep}</div>
                  )}
                </div>
              ) : distributeResult.error === "BATCH_EXISTS" ? (
                <div className="text-yellow-400">
                  Batch already exists for this week. Click "Force Rerun" to override.
                </div>
              ) : (
                <div>
                  <div className="text-red-400 font-medium">Error: {distributeResult.error}</div>
                  {distributeResult.message && (
                    <div className="text-white/50 mt-1">{distributeResult.message}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 1b: Makeup Payout */}
        <div className="rounded-2xl border border-blue-400/20 bg-blue-500/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-400/40 flex items-center justify-center text-blue-300 font-bold">
              1b
            </div>
            <div>
              <h3 className="font-semibold text-white">Makeup Payout (source week → payout week)</h3>
              <p className="text-xs text-white/50">
                Rebuild rewards from a past week and pay them out on a new weekKey
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-white/50 block mb-1">Source Week (stats)</label>
              <input
                type="text"
                value={makeupSourceWeek}
                onChange={(e) => setMakeupSourceWeek(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-white font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Payout Week (new weekKey)</label>
              <input
                type="text"
                value={makeupPayoutWeek}
                onChange={(e) => setMakeupPayoutWeek(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-white font-mono text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-white/60 mb-3">
            <input
              type="checkbox"
              checked={makeupForce}
              onChange={(e) => setMakeupForce(e.target.checked)}
              className="accent-blue-400"
            />
            Force overwrite payout week (only if not on-chain)
          </label>

          <button
            onClick={runMakeupPayout}
            disabled={running !== null || !makeupSourceWeek || !makeupPayoutWeek}
            className="px-4 py-2 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 transition-colors text-sm font-medium text-black"
          >
            {running === "makeup" ? "Running..." : "Run Makeup Payout"}
          </button>

          {makeupResult && (
            <div
              className={`mt-4 p-4 rounded-lg text-sm ${
                makeupResult.ok
                  ? "bg-green-900/30 border border-green-500/30"
                  : "bg-red-900/30 border border-red-500/30"
              }`}
            >
              {makeupResult.ok ? (
                <div>
                  <div className="text-green-400 font-medium mb-2">Makeup Payout Created</div>
                  <div className="text-white/70 space-y-1">
                    <div>
                      Source: {makeupResult.sourceWeekKey} → Payout: {makeupResult.payoutWeekKey}
                    </div>
                    <div>
                      Users: {makeupResult.detail?.totalUsers} | Rewards: {makeupResult.detail?.totalRewards}
                    </div>
                    <div>Total: {makeupResult.detail?.totalAmount} XESS</div>
                  </div>
                </div>
              ) : (
                <div className="text-red-400">Error: {makeupResult.error}</div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Build Claim Epoch (All Users) */}
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-400/50 flex items-center justify-center text-purple-400 font-bold">
              2
            </div>
            <div>
              <h3 className="font-semibold text-white">Build Claim Epoch (All Users)</h3>
              <p className="text-xs text-white/50">
                Build Solana merkle tree from PAID rewards (creates ClaimEpoch + ClaimLeaf)
              </p>
            </div>
          </div>

          <button
            onClick={runBuildEpoch}
            disabled={running !== null}
            className="px-4 py-2 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 transition-colors text-sm font-medium text-black"
          >
            {running === "build" ? "Running..." : "Build Claim Epoch"}
          </button>

          {buildResult && (
            <div
              className={`mt-4 p-4 rounded-lg text-sm ${
                buildResult.ok && !buildResult.skipped
                  ? "bg-green-900/30 border border-green-500/30"
                  : buildResult.skipped
                  ? "bg-yellow-900/30 border border-yellow-500/30"
                  : "bg-red-900/30 border border-red-500/30"
              }`}
            >
              {buildResult.ok && !buildResult.skipped ? (
                <div>
                  <div className="text-green-400 font-medium mb-2">Epoch Built</div>
                  <div className="text-white/70">
                    Epoch: {buildResult.epoch} | Week: {buildResult.weekKey} | Leaves: {buildResult.leafCount}
                  </div>
                  {buildResult.rootHex && (
                    <div className="mt-2">
                      <div className="text-white/50 text-xs mb-1">Root Hash:</div>
                      <code className="text-xs bg-black/40 p-2 rounded block break-all text-cyan-400">
                        {buildResult.rootHex}
                      </code>
                    </div>
                  )}
                </div>
              ) : buildResult.skipped ? (
                <div className="text-yellow-400">
                  Skipped: {buildResult.reason}
                  {buildResult.rootHex && (
                    <div className="mt-1 text-white/50 text-xs">Existing root: {buildResult.rootHex}</div>
                  )}
                </div>
              ) : (
                <div className="text-red-400">Error: {buildResult.error}</div>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Set Root On-Chain (CLI) */}
        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/50 flex items-center justify-center text-orange-400 font-bold">
              3
            </div>
            <div>
              <h3 className="font-semibold text-white">Set Root On-Chain (CLI)</h3>
              <p className="text-xs text-white/50">
                Run this command to publish the merkle root to Solana
              </p>
            </div>
          </div>

          <div className="bg-black/60 rounded-lg p-4 font-mono text-sm">
            <div className="text-white/50 text-xs mb-2">Run in terminal:</div>
            <code className="text-green-400 break-all">
              node solana-programs/xess-claim/set-epoch-root.mjs {epochNum || "<epoch>"} {rootHex || "<rootHex>"}
            </code>
          </div>

          <div className="mt-3 text-xs text-white/50">
            This will create the EpochRoot PDA on devnet with the merkle root.
            Copy the transaction signature for the next step.
          </div>
        </div>

        {/* Step 4: Mark On-Chain in DB */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400 font-bold">
              4
            </div>
            <div>
              <h3 className="font-semibold text-white">Mark setOnChain in DB</h3>
              <p className="text-xs text-white/50">
                Record that the epoch root was published (enables claims)
              </p>
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <div className="w-28">
              <label className="text-xs text-white/50 block mb-1">Epoch #</label>
              <input
                type="number"
                value={markEpoch}
                onChange={(e) => setMarkEpoch(e.target.value)}
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-white font-mono text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-white/50 block mb-1">TX Signature (optional)</label>
              <input
                type="text"
                placeholder="Paste tx signature from CLI output"
                value={markTxSig}
                onChange={(e) => setMarkTxSig(e.target.value)}
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-white font-mono text-sm"
              />
            </div>
          </div>

          <button
            onClick={runMarkOnChain}
            disabled={running !== null || !markEpoch}
            className="px-4 py-2 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 transition-colors text-sm font-medium text-black"
          >
            {running === "mark" ? "Saving..." : "Mark as On-Chain"}
          </button>

          {markResult && (
            <div
              className={`mt-4 p-4 rounded-lg text-sm ${
                markResult.ok ? "bg-green-900/30 border border-green-500/30" : "bg-red-900/30 border border-red-500/30"
              }`}
            >
              {markResult.ok ? (
                <div className="text-green-400">
                  Epoch {markResult.epoch} marked as on-chain
                  {markResult.txSig && <span className="text-white/50"> (tx: {markResult.txSig.slice(0, 20)}...)</span>}
                </div>
              ) : (
                <div className="text-red-400">Error: {markResult.error}</div>
              )}
            </div>
          )}
        </div>

        {/* Done */}
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-400">
              ✓
            </div>
            <div>
              <h3 className="font-semibold text-white">Ready for Claims</h3>
              <p className="text-xs text-white/50">
                Users can now claim their rewards via the claim button
              </p>
            </div>
          </div>
          <p className="text-sm text-white/60 ml-11">
            The claim flow: User clicks claim → /api/rewards/claim/prepare returns proof →
            Wallet signs tx → /api/rewards/claim/confirm verifies and marks claimedAt
          </p>
        </div>

        {/* Dev Tools */}
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
          <button
            onClick={() => setShowDevTools(!showDevTools)}
            className="flex items-center gap-2 text-red-400 font-semibold"
          >
            <span>{showDevTools ? "▼" : "▶"}</span>
            Dev Tools
          </button>

          {showDevTools && (
            <div className="mt-4 space-y-4">
              {/* Force Rerun */}
              <div className="bg-black/40 rounded-lg p-4">
                <h4 className="font-medium text-white mb-2">Force Rerun Weekly Distribute</h4>
                <p className="text-xs text-white/50 mb-3">
                  Re-run weekly distribute even if a batch already exists for this week.
                  Creates new RewardEvents (duplicates if run multiple times).
                </p>
                <button
                  onClick={() => runDistribute(true)}
                  disabled={running !== null || !currentWeekInfo}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 transition-colors text-sm font-medium text-black"
                >
                  {running === "distribute" ? "Running..." : `Force Rerun ${currentWeekInfo?.weekKey || "..."}`}
                </button>
              </div>

              {/* Reset Week */}
              <div className="bg-black/40 rounded-lg p-4">
                <h4 className="font-medium text-white mb-2">Reset Week Data</h4>
                <p className="text-xs text-white/50 mb-3">
                  Delete RewardBatch, RewardEvents, ClaimEpoch, and ClaimLeaf for the selected week.
                  <br />
                  <span className="text-red-400">Only works in development. Cannot be undone!</span>
                </p>
                <button
                  onClick={runResetWeek}
                  disabled={running !== null || !currentWeekInfo}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 transition-colors text-sm font-medium text-black"
                >
                  {running === "reset" ? "Deleting..." : `Reset ${currentWeekInfo?.weekKey || "..."}`}
                </button>

                {resetResult && (
                  <div
                    className={`mt-3 p-3 rounded-lg text-sm ${
                      resetResult.ok ? "bg-green-900/30" : "bg-red-900/30"
                    }`}
                  >
                    {resetResult.ok ? (
                      <div className="text-green-400">
                        Deleted: {resetResult.deleted?.batches} batch, {resetResult.deleted?.events} events,{" "}
                        {resetResult.deleted?.epochs} epoch, {resetResult.deleted?.leaves} leaves
                      </div>
                    ) : (
                      <div className="text-red-400">Error: {resetResult.error}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function addDaysUTC(weekKey: string, days: number): string {
  const d = new Date(`${weekKey}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return weekKey;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ClaimEpoch.totalAtomic uses 9 decimals (matches token mint)
function formatAtomic(atomic: string): string {
  const n = BigInt(atomic);
  const DECIMALS = 1_000_000_000n; // 9 decimals
  const whole = n / DECIMALS;
  const frac = n % DECIMALS;
  if (frac === 0n) return whole.toLocaleString();
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole.toLocaleString()}.${fracStr}`;
}
