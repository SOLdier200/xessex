"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

/* ── XESS tier thresholds (whole tokens, matches specialCredits.ts) ── */
const TIER_THRESHOLDS = [0, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000];

function getXessTier(wholeXess: number): number {
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (wholeXess >= TIER_THRESHOLDS[i]) return i;
  }
  return 0;
}

/* ── Each tier earns a color; accumulated up to current tier ── */
const TIER_COLORS: string[] = [
  "",             // Tier 0: nothing
  "#6b7280",     // Tier 1:  gray-500
  "#3b82f6",     // Tier 2:  blue-500
  "#06b6d4",     // Tier 3:  cyan-500
  "#22c55e",     // Tier 4:  green-500
  "#eab308",     // Tier 5:  yellow-500
  "#f97316",     // Tier 6:  orange-500
  "#ec4899",     // Tier 7:  pink-500
  "#ef4444",     // Tier 8:  red-500
  "#a855f7",     // Tier 9:  purple-500
  "#fbbf24",     // Tier 10: amber/gold-400
];

function getTierGradient(tier: number): string {
  if (tier <= 0) return "rgba(255,255,255,0.12)";
  const colors = TIER_COLORS.slice(1, tier + 1);
  if (colors.length === 1) return colors[0];
  // Double colors for seamless loop
  const doubled = [...colors, ...colors];
  return `linear-gradient(90deg, ${doubled.join(", ")})`;
}

function getTierAnimSpeed(tier: number): string {
  if (tier <= 0) return "0s";
  if (tier <= 2) return "8s";
  if (tier <= 4) return "5s";
  if (tier <= 6) return "3.5s";
  if (tier <= 8) return "2.5s";
  return "1.8s";
}

/* ── SOL purple glow levels ── */
const SOL_GLOW_CHECKPOINTS = [
  { min: 0,    shadow: "none" },
  { min: 1,    shadow: "0 0 6px rgba(168,85,247,0.20)" },
  { min: 2,    shadow: "0 0 8px rgba(168,85,247,0.30)" },
  { min: 5,    shadow: "0 0 12px rgba(168,85,247,0.40)" },
  { min: 10,   shadow: "0 0 16px rgba(168,85,247,0.50)" },
  { min: 20,   shadow: "0 0 20px rgba(168,85,247,0.60)" },
  { min: 50,   shadow: "0 0 26px rgba(168,85,247,0.70)" },
  { min: 100,  shadow: "0 0 32px rgba(168,85,247,0.80)" },
  { min: 1000, shadow: "0 0 40px rgba(168,85,247,0.90), 0 0 70px rgba(168,85,247,0.45)" },
];

function getSolGlow(sol: number): string {
  let glow = "none";
  for (const cp of SOL_GLOW_CHECKPOINTS) {
    if (sol >= cp.min) glow = cp.shadow;
  }
  return glow;
}

type Props = {
  onClick: () => void;
  className?: string;
};

export default function WalletBalanceChip({ onClick, className = "" }: Props) {
  const { publicKey, connected } = useWallet();
  const [xess, setXess] = useState<string | null>(null);
  const [sol, setSol] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!publicKey) return;
    try {
      const res = await fetch(`/api/wallet/balances?wallet=${publicKey.toBase58()}`);
      const data = await res.json();
      if (data.ok) {
        setSol(data.balances.sol.formatted);
        setXess(data.balances.xess.formatted);
      }
    } catch {
      // silent
    }
  }, [publicKey]);

  useEffect(() => {
    if (!connected || !publicKey) {
      setXess(null);
      setSol(null);
      return;
    }
    fetchBalances();
    const id = setInterval(fetchBalances, 60_000);
    return () => clearInterval(id);
  }, [connected, publicKey, fetchBalances]);

  const xessNum = xess !== null ? Number(xess) : 0;
  const solNum = sol !== null ? Number(sol) : 0;

  const tier = useMemo(() => getXessTier(xessNum), [xessNum]);
  const gradient = useMemo(() => getTierGradient(tier), [tier]);
  const animSpeed = useMemo(() => getTierAnimSpeed(tier), [tier]);
  const solGlow = useMemo(() => getSolGlow(solNum), [solNum]);

  if (!connected || xess === null || sol === null) return null;

  const fmtXess = xessNum.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const fmtSol = solNum.toLocaleString(undefined, { maximumFractionDigits: 3 });

  const isMaxTier = tier >= 10;
  const hasAnim = tier > 0;

  // Outer border thickness
  const borderWidth = tier <= 0 ? 1 : tier <= 3 ? 1 : tier <= 6 ? 1.5 : 2;

  return (
    <button
      onClick={onClick}
      className={[
        "relative inline-flex items-center rounded-md whitespace-nowrap",
        "cursor-pointer active:scale-[0.97] transition-transform text-left",
        isMaxTier ? "wallet-chip-max" : "",
        className,
      ].join(" ")}
      style={{
        padding: `${borderWidth}px`,
        background: gradient,
        backgroundSize: hasAnim ? "300% 100%" : undefined,
        animation: hasAnim ? `wallet-chip-border ${animSpeed} linear infinite` : undefined,
        boxShadow: solGlow,
      }}
    >
      <span
        className={[
          "inline-flex items-center gap-1 md:gap-1.5 rounded-[5px]",
          "px-1.5 py-0.5 md:px-3 md:py-1.5 lg:px-4 lg:py-2",
          "text-[9px] md:text-xs lg:text-sm leading-tight",
          "bg-[rgb(8,10,18)]",
        ].join(" ")}
      >
        <span className="text-pink-400 font-bold tabular-nums">Xess:</span>
        <span className="text-white/90 font-bold tabular-nums">{fmtXess}</span>
        <span className="text-white/20 mx-0.5">|</span>
        <span className="text-purple-400 font-bold tabular-nums">Sol:</span>
        <span className="text-white/90 font-bold tabular-nums">{fmtSol}</span>
      </span>
    </button>
  );
}
