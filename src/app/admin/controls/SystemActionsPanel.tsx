"use client";

import { useEffect, useMemo, useState } from "react";

type RunInfo = { lastRunAt: string | null; lastOk: boolean; lastMsg: string | null };
type RunsMap = Record<string, RunInfo>;

type ActionDef = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  endpoint: string;
  danger?: boolean;
};

function fmt(ts: string | null) {
  if (!ts) return "Never";
  const d = new Date(ts);
  return d.toLocaleString();
}

export default function SystemActionsPanel() {
  const actions: ActionDef[] = useMemo(
    () => [
      {
        key: "RECOMPUTE_VIDEO_RANKS",
        title: "Recompute Video Ranks",
        subtitle: "Rebuild global ranks (avgStars, admin score, tie-breakers).",
        icon: "🏆",
        endpoint: "/api/admin/recompute-ranks",
      },
      {
        key: "RECOMPUTE_REWARDS_EPOCH",
        title: "Recompute Rewards Epoch",
        subtitle: "Rebuild epoch totals, eligibility, and payout tables.",
        icon: "🔄",
        endpoint: "/api/admin/recompute-rewards-epoch",
        danger: true,
      },
      {
        key: "RECALCULATE_LEADERBOARDS",
        title: "Recalculate Leaderboards",
        subtitle: "Rebuild weekly, monthly, and all-time leaderboards.",
        icon: "🧮",
        endpoint: "/api/admin/recalculate-leaderboards",
      },
      {
        key: "FLUSH_CLOUDFLARE_CACHE",
        title: "Flush Cloudflare Cache",
        subtitle: "Purge the entire zone cache (purge_everything).",
        icon: "🧹",
        endpoint: "/api/admin/flush-cloudflare-cache",
        danger: true,
      },
      {
        key: "RECOMPUTE_ANALYTICS",
        title: "Recompute Analytics",
        subtitle: "Rebuild analytics aggregates and counters.",
        icon: "📊",
        endpoint: "/api/admin/recompute-analytics",
      },
    ],
    []
  );

  const [runs, setRuns] = useState<RunsMap>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ open: boolean; action?: ActionDef }>({
    open: false,
  });

  async function refreshStatus() {
    const res = await fetch("/api/admin/system-actions/status", { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) setRuns(data.runs || {});
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  async function runAction(action: ActionDef) {
    setLoadingKey(action.key);
    try {
      const res = await fetch(action.endpoint, { method: "POST" });
      await res.json().catch(() => ({}));
    } finally {
      setLoadingKey(null);
      await refreshStatus();
    }
  }

  function openConfirm(action: ActionDef) {
    setConfirm({ open: true, action });
  }

  function closeConfirm() {
    setConfirm({ open: false, action: undefined });
  }

  const confirmModal =
    confirm.open && confirm.action ? (
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh]">
        <div className="absolute inset-0 bg-black/70" onClick={closeConfirm} />
        <div className="relative w-full max-w-lg neon-border rounded-2xl bg-black/90 border-red-500/40 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-400/50 flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <div className="text-xl font-semibold text-white">Confirm System Action</div>
              <div className="text-white/60 text-sm">This may affect global site state.</div>
            </div>
          </div>

          <div className="rounded-xl border border-red-500/30 bg-black/50 p-4">
            <div className="text-white font-semibold">{confirm.action.title}</div>
            <div className="text-white/60 text-sm mt-1">{confirm.action.subtitle}</div>
          </div>

          <div className="flex gap-3 mt-5 justify-end">
            <button
              onClick={closeConfirm}
              className="px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-white/70 hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                const action = confirm.action!;
                closeConfirm();
                await runAction(action);
              }}
              className="px-4 py-2 rounded-xl border border-red-400/50 bg-red-500/20 text-red-200 font-semibold hover:bg-red-500/30 transition"
            >
              Yes, Run It
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      {confirmModal}

      <div className="mt-8 neon-border rounded-2xl p-6 bg-black/20 border-red-500/30">
        <h3 className="text-lg font-semibold text-red-300 mb-2">System Actions</h3>
        <p className="text-sm text-white/60 mb-4">
          Heavy operations that affect global site state. Use carefully.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {actions.map((action) => {
            const info = runs[action.key];
            const isLoading = loadingKey === action.key;

            return (
              <div key={action.key} className="neon-border rounded-2xl p-6 bg-black/30">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-12 h-12 rounded-xl border flex items-center justify-center ${
                      action.danger
                        ? "bg-red-500/20 border-red-400/50"
                        : "bg-white/5 border-white/15"
                    }`}
                  >
                    <span className="text-2xl">{action.icon}</span>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">{action.title}</div>
                    <div className="text-sm text-white/60">{action.subtitle}</div>
                  </div>
                </div>

                <div className="text-sm text-white/60 mb-4">
                  <div>
                    <span className="text-white/50">Last run:</span>{" "}
                    <span className="text-white/80">{fmt(info?.lastRunAt ?? null)}</span>
                  </div>
                  <div>
                    <span className="text-white/50">Last result:</span>{" "}
                    <span className={info?.lastOk ? "text-emerald-300" : "text-white/60"}>
                      {info?.lastMsg
                        ? info.lastMsg
                        : info?.lastRunAt
                        ? info.lastOk
                          ? "OK"
                          : "Failed"
                        : "—"}
                    </span>
                  </div>
                </div>

                <button
                  disabled={isLoading}
                  onClick={() => (action.danger ? openConfirm(action) : runAction(action))}
                  className={`w-full px-4 py-3 rounded-xl border font-semibold transition ${
                    isLoading
                      ? "border-white/20 bg-white/5 text-white/40 cursor-not-allowed"
                      : action.danger
                      ? "border-red-400/50 bg-red-500/20 text-red-200 hover:bg-red-500/30"
                      : "border-white/20 bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                >
                  {isLoading ? "Running..." : action.danger ? "Run (Confirm)" : "Run"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
