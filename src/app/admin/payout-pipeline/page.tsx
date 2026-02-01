"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";

type RewardStats = {
  paidUnclaimed: number;
  paidClaimed: number;
  pending: number;
  totalUsers: number;
  weekKeys: string[];
};

type DistributeResult = {
  ok: boolean;
  error?: string;
  skipped?: boolean;
  totalUsers?: number;
  totalRewards?: number;
  totalAmount?: string;
};

type EpochInfo = {
  epoch: number;
  weekKey: string;
  rootHex: string;
  totalAtomic: string;
  leafCount: number;
  setOnChain: boolean;
  onChainTxSig: string | null;
};

type CreateEpochResult = {
  ok: boolean;
  error?: string;
  message?: string;
  sourceWeekKey?: string;
  testWeekKey?: string;
  copiedRewards?: boolean;
  epoch?: number;
  rootHex?: string;
  leafCount?: number;
  rewardCount?: number;
  totalXess?: string;
  nextStep?: string;
};

type MarkOnChainResult = {
  ok: boolean;
  error?: string;
  epoch?: number;
  txSig?: string;
};

export default function PayoutPipelinePage() {
  const [loading, setLoading] = useState(true);
  const [rewardStats, setRewardStats] = useState<RewardStats | null>(null);
  const [latestEpoch, setLatestEpoch] = useState<EpochInfo | null>(null);
  const [distributeResult, setDistributeResult] = useState<DistributeResult | null>(null);
  const [createResult, setCreateResult] = useState<CreateEpochResult | null>(null);
  const [markEpoch, setMarkEpoch] = useState("");
  const [markTxSig, setMarkTxSig] = useState("");
  const [markResult, setMarkResult] = useState<MarkOnChainResult | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, epochRes] = await Promise.all([
        fetch("/api/admin/reward-stats"),
        fetch("/api/admin/build-claim-epoch-v2", { method: "GET" }),
      ]);

      const statsJson = await statsRes.json();
      const epochJson = await epochRes.json();

      if (statsJson.ok) {
        setRewardStats(statsJson);
      }
      if (epochJson.ok && epochJson.latestEpoch) {
        setLatestEpoch(epochJson.latestEpoch);
        if (!epochJson.latestEpoch.setOnChain) {
          setMarkEpoch(String(epochJson.latestEpoch.epoch));
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function runDistribute() {
    setRunning("distribute");
    setDistributeResult(null);

    const toastId = toast.loading("Running weekly distribute...");

    try {
      const r = await fetch("/api/admin/recompute-rewards-epoch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const j = await r.json();
      setDistributeResult(j);

      if (j.ok && !j.skipped) {
        toast.success("Rewards distributed!", {
          id: toastId,
          description: `${j.totalRewards || 0} rewards for ${j.totalUsers || 0} users`,
        });
      } else if (j.skipped) {
        toast.info("Already distributed", { id: toastId });
      } else {
        toast.error("Failed", { id: toastId, description: j.error });
      }
    } catch (e) {
      setDistributeResult({ ok: false, error: String(e) });
      toast.error("Failed", { id: toastId, description: String(e) });
    }
    setRunning(null);
    loadData();
  }

  async function runCreateEpoch() {
    setRunning("create");
    setCreateResult(null);

    const toastId = toast.loading("Creating new epoch...", {
      description: "Building merkle tree from real rewards",
    });

    try {
      const r = await fetch("/api/admin/create-test-epoch", { method: "POST" });
      const j = await r.json();
      setCreateResult(j);

      if (j.ok) {
        setMarkEpoch(String(j.epoch));
        toast.success("Epoch created!", {
          id: toastId,
          description: `Epoch #${j.epoch} with ${j.leafCount} users, ${j.totalXess} XESS`,
        });
      } else {
        toast.error("Failed to create epoch", {
          id: toastId,
          description: j.error || "Unknown error",
        });
      }
    } catch (e) {
      setCreateResult({ ok: false, error: String(e) });
      toast.error("Failed", { id: toastId, description: String(e) });
    }
    setRunning(null);
    loadData();
  }

  async function runMarkOnChain() {
    if (!markEpoch) return;
    setRunning("mark");
    setMarkResult(null);

    const toastId = toast.loading("Marking epoch on-chain...");

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
        toast.success("Marked on-chain!", { id: toastId });
      } else {
        toast.error("Failed", { id: toastId, description: j.error });
      }
    } catch (e) {
      setMarkResult({ ok: false, error: String(e) });
      toast.error("Failed", { id: toastId, description: String(e) });
    }
    setRunning(null);
    loadData();
  }

  const rootHex = createResult?.rootHex || latestEpoch?.rootHex || "";
  const epochNum = createResult?.epoch || latestEpoch?.epoch || 0;

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Payout Pipeline</h1>
          <p className="text-white/60 text-sm mt-1">
            Create epochs to test reward claims
          </p>
        </div>
        <Link
          href="/admin/controls"
          className="px-4 py-2 rounded-full border border-white/30 bg-black/40 text-white text-sm font-semibold hover:bg-white/10 transition"
        >
          ← Back
        </Link>
      </div>

      {/* Current Rewards Status */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Reward Status</h2>
        {loading ? (
          <div className="text-white/50">Loading...</div>
        ) : rewardStats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/40 rounded-xl p-4">
              <div className="text-xs text-white/50 mb-1">Pending (Ready to Claim)</div>
              <div className="text-2xl font-bold text-green-400">{rewardStats.paidUnclaimed}</div>
            </div>
            <div className="bg-black/40 rounded-xl p-4">
              <div className="text-xs text-white/50 mb-1">Already Claimed</div>
              <div className="text-2xl font-bold text-white/50">{rewardStats.paidClaimed}</div>
            </div>
            <div className="bg-black/40 rounded-xl p-4">
              <div className="text-xs text-white/50 mb-1">Users with Rewards</div>
              <div className="text-2xl font-bold text-white">{rewardStats.totalUsers}</div>
            </div>
            <div className="bg-black/40 rounded-xl p-4">
              <div className="text-xs text-white/50 mb-1">Week Keys</div>
              <div className="text-sm font-mono text-white/70">
                {rewardStats.weekKeys.slice(0, 3).join(", ")}
                {rewardStats.weekKeys.length > 3 && "..."}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-white/50">No reward data available</div>
        )}

        {rewardStats?.paidUnclaimed === 0 && (
          <div className="mt-4 p-4 rounded-lg bg-yellow-900/30 border border-yellow-500/30">
            <div className="text-yellow-400 text-sm mb-3">
              No pending rewards found. Run Weekly Distribute to calculate and create rewards from user activity.
            </div>
            <button
              onClick={runDistribute}
              disabled={running !== null}
              className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 transition-colors text-sm font-medium text-black"
            >
              {running === "distribute" ? "Distributing..." : "Run Weekly Distribute"}
            </button>
            {distributeResult && (
              <div className={`mt-3 text-sm ${distributeResult.ok ? "text-green-400" : "text-red-400"}`}>
                {distributeResult.ok
                  ? `Created ${distributeResult.totalRewards || 0} rewards for ${distributeResult.totalUsers || 0} users`
                  : distributeResult.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Latest Epoch Info */}
      {latestEpoch && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Latest Epoch</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <span className="text-white/50 text-xs">Epoch</span>
              <div className="font-mono text-white">#{latestEpoch.epoch}</div>
            </div>
            <div>
              <span className="text-white/50 text-xs">Week</span>
              <div className="font-mono text-white">{latestEpoch.weekKey}</div>
            </div>
            <div>
              <span className="text-white/50 text-xs">Users</span>
              <div className="text-white">{latestEpoch.leafCount}</div>
            </div>
            <div>
              <span className="text-white/50 text-xs">On-Chain</span>
              <div className={latestEpoch.setOnChain ? "text-green-400" : "text-yellow-400"}>
                {latestEpoch.setOnChain ? "Yes" : "No"}
              </div>
            </div>
          </div>
          {latestEpoch.rootHex && (
            <div>
              <div className="text-xs text-white/50 mb-1">Root Hash:</div>
              <code className="text-xs bg-black/60 p-2 rounded block break-all text-cyan-400">
                {latestEpoch.rootHex}
              </code>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Create New Epoch */}
      <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-400/50 flex items-center justify-center text-green-400 font-bold">
            1
          </div>
          <div>
            <h3 className="font-semibold text-white">Create New Epoch</h3>
            <p className="text-xs text-white/50">
              Builds merkle tree from PAID unclaimed rewards with a fresh epoch number
            </p>
          </div>
        </div>

        <button
          onClick={runCreateEpoch}
          disabled={running !== null || rewardStats?.paidUnclaimed === 0}
          className="px-6 py-3 rounded-lg bg-green-500 hover:bg-green-400 disabled:opacity-50 transition-colors text-sm font-bold text-black"
        >
          {running === "create" ? "Creating..." : "Create New Epoch"}
        </button>

        {createResult && (
          <div
            className={`mt-4 p-4 rounded-lg text-sm ${
              createResult.ok
                ? "bg-green-900/30 border border-green-500/30"
                : "bg-red-900/30 border border-red-500/30"
            }`}
          >
            {createResult.ok ? (
              <div className="space-y-2">
                <div className="text-green-400 font-medium">
                  Epoch #{createResult.epoch} Created!
                  {createResult.copiedRewards && (
                    <span className="text-yellow-400 ml-2">(copied to new weekKey)</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-white/70">
                  <div>Users: <span className="text-white">{createResult.leafCount}</span></div>
                  <div>Rewards: <span className="text-white">{createResult.rewardCount}</span></div>
                  <div>Total: <span className="text-white">{createResult.totalXess} XESS</span></div>
                  <div>Week: <span className="font-mono text-white">{createResult.testWeekKey}</span></div>
                </div>
              </div>
            ) : (
              <div className="text-red-400">
                {createResult.error}
                {createResult.message && <div className="text-white/50 mt-1">{createResult.message}</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Set Root On-Chain (CLI) */}
      <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/50 flex items-center justify-center text-orange-400 font-bold">
            2
          </div>
          <div>
            <h3 className="font-semibold text-white">Set Root On-Chain (CLI)</h3>
            <p className="text-xs text-white/50">
              Run this command to publish the merkle root to Solana
            </p>
          </div>
        </div>

        <div className="bg-black/60 rounded-lg p-4 font-mono text-sm">
          <code className="text-green-400 break-all">
            node solana-programs/xess-claim/set-epoch-root.mjs {epochNum || "<epoch>"} {rootHex || "<rootHex>"}
          </code>
        </div>
      </div>

      {/* Step 3: Mark On-Chain */}
      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/50 flex items-center justify-center text-blue-400 font-bold">
            3
          </div>
          <div>
            <h3 className="font-semibold text-white">Mark On-Chain in DB</h3>
            <p className="text-xs text-white/50">
              After CLI succeeds, mark the epoch as published (enables claims)
            </p>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="w-24">
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
              placeholder="Paste from CLI output"
              value={markTxSig}
              onChange={(e) => setMarkTxSig(e.target.value)}
              className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-white font-mono text-sm"
            />
          </div>
        </div>

        <button
          onClick={runMarkOnChain}
          disabled={running !== null || !markEpoch}
          className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-50 transition-colors text-sm font-medium text-white"
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
                Epoch {markResult.epoch} marked as on-chain! Users can now claim.
              </div>
            ) : (
              <div className="text-red-400">Error: {markResult.error}</div>
            )}
          </div>
        )}
      </div>

      {/* Done */}
      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-400">
            ✓
          </div>
          <div>
            <h3 className="font-semibold text-white">Ready for Claims</h3>
            <p className="text-xs text-white/50">
              Users can claim from their profile page. To test again, click "Create New Epoch" for a fresh epoch number.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
