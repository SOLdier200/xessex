"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

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
  } | null;
};

type DistributeResult = {
  ok: boolean;
  error?: string;
  message?: string;
  weekKey?: string;
  weekIndex?: number;
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
  const [epochStatus, setEpochStatus] = useState<EpochStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Selected week
  const [selectedWeek, setSelectedWeek] = useState<"this" | "last">("last");

  // Step 1: Weekly Distribute
  const [distributeResult, setDistributeResult] = useState<DistributeResult | null>(null);

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
      const [weekRes, epochRes] = await Promise.all([
        fetch("/api/admin/recompute-rewards-epoch", { method: "GET" }),
        fetch("/api/admin/build-claim-epoch", { method: "GET" }),
      ]);

      const weekJson = await weekRes.json();
      const epochJson = await epochRes.json();

      if (weekJson.ok) {
        setWeekData(weekJson);
      }
      if (epochJson.ok) {
        setEpochStatus(epochJson);
        // Pre-fill mark epoch field
        if (epochJson.latestEpoch && !epochJson.latestEpoch.setOnChain) {
          setMarkEpoch(String(epochJson.latestEpoch.epoch));
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
    } catch (e) {
      setDistributeResult({ ok: false, error: String(e) });
    }
    setRunning(null);
    loadData();
  }

  // Step 2: Run Build Epoch
  async function runBuildEpoch() {
    setRunning("build");
    setBuildResult(null);
    try {
      const r = await fetch("/api/admin/build-claim-epoch", { method: "POST" });
      const j = await r.json();
      setBuildResult(j);
      // Pre-fill mark epoch field
      if (j.ok && j.epoch) {
        setMarkEpoch(String(j.epoch));
      }
    } catch (e) {
      setBuildResult({ ok: false, error: String(e) });
    }
    setRunning(null);
    loadData();
  }

  // Step 3: Mark On-Chain
  async function runMarkOnChain() {
    if (!markEpoch) return;
    setRunning("mark");
    setMarkResult(null);
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
    } catch (e) {
      setMarkResult({ ok: false, error: String(e) });
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

  const latestEpoch = epochStatus?.latestEpoch;
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
        ) : epochStatus ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/40 rounded-xl p-4">
              <div className="text-xs text-white/50 mb-1">Pending Week</div>
              <div className="font-mono text-white">
                {epochStatus.pendingWeekKey || "none"}
              </div>
            </div>
            <div className="bg-black/40 rounded-xl p-4">
              <div className="text-xs text-white/50 mb-1">Epoch Built</div>
              <div className={epochStatus.pendingEpochBuilt ? "text-green-400" : "text-yellow-400"}>
                {epochStatus.pendingEpochBuilt ? "Yes" : "No"}
              </div>
            </div>
            <div className="bg-black/40 rounded-xl p-4">
              <div className="text-xs text-white/50 mb-1">On-Chain</div>
              <div className={epochStatus.pendingEpochSetOnChain ? "text-green-400" : "text-yellow-400"}>
                {epochStatus.pendingEpochSetOnChain ? "Yes" : "No"}
              </div>
            </div>
            <div className="bg-black/40 rounded-xl p-4">
              <div className="text-xs text-white/50 mb-1">Latest Epoch</div>
              <div className="font-mono text-white">
                {latestEpoch ? `#${latestEpoch.epoch}` : "none"}
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

        {/* Step 2: Build Claim Epoch */}
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-400/50 flex items-center justify-center text-purple-400 font-bold">
              2
            </div>
            <div>
              <h3 className="font-semibold text-white">Build Claim Epoch</h3>
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
