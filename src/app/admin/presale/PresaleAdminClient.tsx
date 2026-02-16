"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { fetchPresale } from "@/lib/fetchByHost";

type SaleConfig = {
  id: string;
  activePhase: string;
  totalSupplyXess: string;
  saleAllocationXess: string;
  privateAllocation: string;
  publicAllocation: string;
  walletCapXess: string;
  soldPrivateXess: string;
  soldPublicXess: string;
  privatePriceUsdMicros: string;
  publicPriceUsdMicros: string;
  privateLamportsPerXess: string;
  publicLamportsPerXess: string;
  privateMerkleRootHex: string | null;
  privateStartsAt: string | null;
  privateEndsAt: string | null;
  publicStartsAt: string | null;
  publicEndsAt: string | null;
};

type Contribution = {
  id: string;
  createdAt: string;
  phase: string;
  wallet: string;
  asset: string;
  xessAmount: string;
  paidLamports: string | null;
  paidUsdcAtomic: string | null;
  txSig: string | null;
  status: string;
  confirmedAt: string | null;
};

type Totals = {
  xessSold: string;
  solLamports: string;
  usdcAtomic: string;
};

type PresaleData = {
  ok: boolean;
  config: SaleConfig;
  contributions: Contribution[];
  totals: Totals;
};

type TreasuryBalances = {
  treasuryWallet: string;
  usdcAta: string;
  solLamports: string;
  usdcAtomic: string;
};

function formatXess(amount: string): string {
  const num = BigInt(amount);
  if (num >= 1_000_000n) {
    return `${(Number(num) / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000n) {
    return `${(Number(num) / 1_000).toFixed(2)}K`;
  }
  return num.toString();
}

function formatSol(lamports: string): string {
  return (Number(lamports) / 1e9).toFixed(4);
}

function formatUsdc(atomic: string): string {
  return (Number(atomic) / 1e6).toFixed(2);
}

function shortenWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function shortenTx(txSig: string | null): string {
  if (!txSig) return "-";
  return `${txSig.slice(0, 8)}...`;
}

/** Client-side lamports computation matching server logic */
function computeLamports(usdMicrosStr: string, solPriceUsd: number): string {
  try {
    const micros = BigInt(usdMicrosStr);
    const solMicros = BigInt(Math.round(solPriceUsd * 1_000_000));
    if (solMicros === 0n) return "—";
    return ((micros * 1_000_000_000n) / solMicros).toString();
  } catch {
    return "—";
  }
}

export default function PresaleAdminClient({ isAdmin }: { isAdmin: boolean }) {
  const [data, setData] = useState<PresaleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [usdcPrice, setUsdcPrice] = useState<number | null>(null);
  const [balances, setBalances] = useState<TreasuryBalances | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(true);

  // Edit form state (USD prices only — lamports are auto-computed)
  const [editPhase, setEditPhase] = useState("");
  const [editWalletCap, setEditWalletCap] = useState("");
  const [editPrivateUsdMicros, setEditPrivateUsdMicros] = useState("");
  const [editPublicUsdMicros, setEditPublicUsdMicros] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchPresale("/api/admin/presale", { credentials: "include" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to load");
      setData(json);

      // Initialize edit fields (no lamports — they're auto-computed)
      setEditPhase(json.config.activePhase);
      setEditWalletCap(json.config.walletCapXess);
      setEditPrivateUsdMicros(json.config.privatePriceUsdMicros);
      setEditPublicUsdMicros(json.config.publicPriceUsdMicros);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch live SOL + USDC prices from Pyth proxy
  useEffect(() => {
    function fetchPrices() {
      fetchPresale("/api/pyth/prices")
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            if (d.SOL_USD?.price) setSolPrice(d.SOL_USD.price);
            if (d.USDC_USD?.price) setUsdcPrice(d.USDC_USD.price);
          }
        })
        .catch(() => {});
    }
    fetchPrices();
    const iv = setInterval(fetchPrices, 30_000);
    return () => clearInterval(iv);
  }, []);

  // Fetch treasury on-chain balances
  useEffect(() => {
    function fetchBalances() {
      setBalancesLoading(true);
      fetchPresale("/api/admin/presale/balances", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setBalances(d);
        })
        .catch(() => {})
        .finally(() => setBalancesLoading(false));
    }
    fetchBalances();
    const iv = setInterval(fetchBalances, 180_000);
    return () => clearInterval(iv);
  }, []);

  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const res = await fetchPresale("/api/admin/presale", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activePhase: editPhase,
          walletCapXess: editWalletCap,
          privatePriceUsdMicros: editPrivateUsdMicros,
          publicPriceUsdMicros: editPublicUsdMicros,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to save");

      // Refetch to get server state
      const freshRes = await fetchPresale("/api/admin/presale", { credentials: "include", cache: "no-store" });
      const freshJson = await freshRes.json();

      if (freshJson.ok) {
        setData(freshJson);
        setEditPhase(freshJson.config.activePhase);
        setEditWalletCap(freshJson.config.walletCapXess);
        setEditPrivateUsdMicros(freshJson.config.privatePriceUsdMicros);
        setEditPublicUsdMicros(freshJson.config.publicPriceUsdMicros);
        toast.success("Config saved! Lamports auto-computed from live SOL price.");
      } else {
        toast.error("Saved but failed to refresh: " + freshJson.error);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(msg);
      toast.error(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-8">
        <div className="text-white/50 text-center">Loading presale data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black p-8">
        <div className="text-red-400 text-center">Error: {error}</div>
      </div>
    );
  }

  const { config, contributions, totals } = data;

  const privateRemaining =
    BigInt(config.privateAllocation) - BigInt(config.soldPrivateXess);
  const publicRemaining =
    BigInt(config.publicAllocation) - BigInt(config.soldPublicXess);

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Presale Administration</h1>
          <Link
            href="/launch"
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition text-sm"
          >
            View Launch Page
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/50 text-sm">Total XESS Sold</div>
            <div className="text-2xl font-bold text-emerald-400">
              {formatXess(totals.xessSold)}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/50 text-sm">SOL Collected</div>
            <div className="text-2xl font-bold text-purple-400">
              {formatSol(totals.solLamports)} SOL
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/50 text-sm">USDC Collected</div>
            <div className="text-2xl font-bold text-blue-400">
              ${formatUsdc(totals.usdcAtomic)}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/50 text-sm">Active Phase</div>
            <div
              className={`text-2xl font-bold ${
                config.activePhase === "closed"
                  ? "text-red-400"
                  : config.activePhase === "public"
                  ? "text-emerald-400"
                  : "text-yellow-400"
              }`}
            >
              {config.activePhase.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Treasury Wallet Balances */}
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-4">
            Treasury Wallet Balances
          </h2>
          {balancesLoading && !balances ? (
            <div className="text-white/50 text-sm">Loading on-chain balances...</div>
          ) : !balances ? (
            <div className="text-red-400 text-sm">Failed to load balances</div>
          ) : (() => {
            const solBal = Number(balances.solLamports) / 1e9;
            const usdcBal = Number(balances.usdcAtomic) / 1e6;
            const solUsd = solPrice ? solBal * solPrice : null;
            const usdcUsd = usdcPrice ? usdcBal * usdcPrice : usdcBal;
            const totalUsd = solUsd !== null ? solUsd + usdcUsd : null;

            // Earned totals from DB (confirmed contributions)
            const earnedSol = Number(totals.solLamports) / 1e9;
            const earnedUsdc = Number(totals.usdcAtomic) / 1e6;
            const earnedSolUsd = solPrice ? earnedSol * solPrice : null;
            const earnedUsdcUsd = usdcPrice ? earnedUsdc * usdcPrice : earnedUsdc;
            const earnedTotalUsd = earnedSolUsd !== null ? earnedSolUsd + earnedUsdcUsd : null;

            return (
              <div className="space-y-6">
                {/* On-chain balances */}
                <div>
                  <h3 className="text-sm font-medium text-white/60 mb-3 uppercase tracking-wider">
                    Current On-Chain Balance
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-lg border border-white/10 bg-black/40 p-4">
                      <div className="text-white/50 text-xs mb-1">SOL Balance</div>
                      <div className="text-xl font-bold text-purple-400 font-mono">
                        {solBal.toFixed(4)} SOL
                      </div>
                      <div className="text-sm text-white/40 font-mono">
                        {solUsd !== null ? `$${solUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/40 p-4">
                      <div className="text-white/50 text-xs mb-1">USDC Balance</div>
                      <div className="text-xl font-bold text-blue-400 font-mono">
                        {usdcBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                      </div>
                      <div className="text-sm text-white/40 font-mono">
                        ${usdcUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                      <div className="text-white/50 text-xs mb-1">Total Value (USD)</div>
                      <div className="text-2xl font-bold text-cyan-400 font-mono">
                        {totalUsd !== null
                          ? `$${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "—"}
                      </div>
                      <div className="text-xs text-white/30 mt-1">
                        SOL @ {solPrice ? `$${solPrice.toFixed(2)}` : "—"} &middot; USDC @ {usdcPrice ? `$${usdcPrice.toFixed(4)}` : "$1.00"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Earned totals from DB */}
                <div>
                  <h3 className="text-sm font-medium text-white/60 mb-3 uppercase tracking-wider">
                    Total Earned (Confirmed Sales)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-lg border border-white/10 bg-black/40 p-4">
                      <div className="text-white/50 text-xs mb-1">SOL Earned</div>
                      <div className="text-xl font-bold text-purple-400 font-mono">
                        {earnedSol.toFixed(4)} SOL
                      </div>
                      <div className="text-sm text-white/40 font-mono">
                        {earnedSolUsd !== null ? `$${earnedSolUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/40 p-4">
                      <div className="text-white/50 text-xs mb-1">USDC Earned</div>
                      <div className="text-xl font-bold text-blue-400 font-mono">
                        {earnedUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                      </div>
                      <div className="text-sm text-white/40 font-mono">
                        ${earnedUsdcUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <div className="text-white/50 text-xs mb-1">Total Earned (USD)</div>
                      <div className="text-2xl font-bold text-emerald-400 font-mono">
                        {earnedTotalUsd !== null
                          ? `$${earnedTotalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Wallet addresses */}
                <div className="flex flex-wrap gap-4 text-xs text-white/30 font-mono">
                  <span>Treasury: {balances.treasuryWallet}</span>
                  <span>USDC ATA: {balances.usdcAta}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Allocation Progress */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Allocation Progress
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/70">Private Sale</span>
                <span className="text-white/50">
                  {formatXess(config.soldPrivateXess)} /{" "}
                  {formatXess(config.privateAllocation)}
                </span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 transition-all"
                  style={{
                    width: `${
                      (Number(config.soldPrivateXess) /
                        Number(config.privateAllocation)) *
                      100
                    }%`,
                  }}
                />
              </div>
              <div className="text-xs text-white/40 mt-1">
                {formatXess(privateRemaining.toString())} remaining
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/70">Public Sale</span>
                <span className="text-white/50">
                  {formatXess(config.soldPublicXess)} /{" "}
                  {formatXess(config.publicAllocation)}
                </span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{
                    width: `${
                      (Number(config.soldPublicXess) /
                        Number(config.publicAllocation)) *
                      100
                    }%`,
                  }}
                />
              </div>
              <div className="text-xs text-white/40 mt-1">
                {formatXess(publicRemaining.toString())} remaining
              </div>
            </div>
          </div>
        </div>

        {/* Config Editor (Admin Only) */}
        {isAdmin && (
          <div className="rounded-xl border border-pink-500/30 bg-pink-500/5 p-6">
            <h2 className="text-xl font-semibold text-pink-300 mb-4">
              Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Active Phase
                </label>
                <select
                  value={editPhase}
                  onChange={(e) => setEditPhase(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black border border-white/20 text-white"
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Wallet Cap (XESS)
                </label>
                <input
                  type="text"
                  value={editWalletCap}
                  onChange={(e) => setEditWalletCap(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black border border-white/20 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Private USD Price (micros)
                </label>
                <input
                  type="text"
                  value={editPrivateUsdMicros}
                  onChange={(e) => setEditPrivateUsdMicros(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black border border-white/20 text-white"
                  placeholder="e.g. 39 = $0.000039"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Public USD Price (micros)
                </label>
                <input
                  type="text"
                  value={editPublicUsdMicros}
                  onChange={(e) => setEditPublicUsdMicros(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black border border-white/20 text-white"
                  placeholder="e.g. 46 = $0.000046"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Live SOL/USD (Pyth)
                </label>
                <div className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-cyan-400 font-mono">
                  {solPrice ? `$${solPrice.toFixed(2)}` : "Loading..."}
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Computed lamports/XESS
                </label>
                <div className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white/70 font-mono text-xs">
                  {solPrice && editPrivateUsdMicros ? (
                    <>
                      <span className="text-yellow-300">Priv:</span>{" "}
                      {computeLamports(editPrivateUsdMicros, solPrice)}
                      {" / "}
                      <span className="text-emerald-300">Pub:</span>{" "}
                      {computeLamports(editPublicUsdMicros, solPrice)}
                    </>
                  ) : "—"}
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-pink-500 text-white font-medium hover:bg-pink-600 disabled:opacity-50 transition"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <span className="text-xs text-white/40">
                Lamports are auto-computed from USD price + live SOL rate on save
              </span>
            </div>
          </div>
        )}

        {/* Current Config Display */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Current Pricing
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-white/50">Private Price (USD):</span>
              <div className="text-white font-mono">
                ${(Number(config.privatePriceUsdMicros) / 1_000_000).toFixed(6)}
              </div>
            </div>
            <div>
              <span className="text-white/50">Public Price (USD):</span>
              <div className="text-white font-mono">
                ${(Number(config.publicPriceUsdMicros) / 1_000_000).toFixed(6)}
              </div>
            </div>
            <div>
              <span className="text-white/50">SOL/USD (Pyth live):</span>
              <div className="text-cyan-400 font-mono">
                {solPrice ? `$${solPrice.toFixed(2)}` : "—"}
              </div>
            </div>
            <div>
              <span className="text-white/50">Private (lamports/XESS):</span>
              <div className="text-white font-mono">
                {solPrice
                  ? computeLamports(config.privatePriceUsdMicros, solPrice)
                  : config.privateLamportsPerXess}
              </div>
              <div className="text-white/30 text-xs">DB fallback: {config.privateLamportsPerXess}</div>
            </div>
            <div>
              <span className="text-white/50">Public (lamports/XESS):</span>
              <div className="text-white font-mono">
                {solPrice
                  ? computeLamports(config.publicPriceUsdMicros, solPrice)
                  : config.publicLamportsPerXess}
              </div>
              <div className="text-white/30 text-xs">DB fallback: {config.publicLamportsPerXess}</div>
            </div>
          </div>
        </div>

        {/* Contributions Table */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Recent Contributions ({contributions.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/50 border-b border-white/10">
                  <th className="text-left py-2 px-2">Time</th>
                  <th className="text-left py-2 px-2">Wallet</th>
                  <th className="text-left py-2 px-2">Phase</th>
                  <th className="text-right py-2 px-2">XESS</th>
                  <th className="text-right py-2 px-2">Paid</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">TX</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="py-2 px-2 text-white/70">
                      {new Date(c.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-2 font-mono text-white/80">
                      {shortenWallet(c.wallet)}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          c.phase === "private"
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {c.phase}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-white font-mono">
                      {formatXess(c.xessAmount)}
                    </td>
                    <td className="py-2 px-2 text-right text-white/80 font-mono">
                      {c.asset === "SOL" && c.paidLamports
                        ? `${formatSol(c.paidLamports)} SOL`
                        : c.asset === "USDC" && c.paidUsdcAtomic
                        ? `$${formatUsdc(c.paidUsdcAtomic)}`
                        : "-"}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          c.status === "CONFIRMED"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : c.status === "PENDING"
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-mono text-white/50">
                      {c.txSig ? (
                        <a
                          href={`https://solscan.io/tx/${c.txSig}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-pink-400 transition"
                        >
                          {shortenTx(c.txSig)}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
                {contributions.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-white/40"
                    >
                      No contributions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
