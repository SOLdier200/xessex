"use client";

import { useEffect, useState } from "react";
import { presaleUrl } from "@/lib/presaleOrigin";

type PricesResponse = {
  ok: boolean;
  SOL_USD?: { price: number; conf: number };
  USDC_USD?: { price: number; conf: number };
  stale?: boolean;
  error?: string;
};

function fmt(n: number, digits = 2) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function PythPriceTicker({
  refreshMs = 2500,
}: {
  refreshMs?: number;
}) {
  const [data, setData] = useState<PricesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const r = await fetch(presaleUrl("/api/pyth/prices"), { cache: "no-store" });
      const j = (await r.json()) as PricesResponse;
      setData(j);
    } catch (e: any) {
      setData({ ok: false, error: e?.message || "Failed to load prices" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, refreshMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs]);

  if (loading) {
    return (
      <div className="text-sm opacity-80">Loading live prices…</div>
    );
  }

  if (!data?.ok) {
    return (
      <div className="text-sm text-red-300">
        Price feed error{data?.error ? `: ${data.error}` : ""}
      </div>
    );
  }

  const sol = data.SOL_USD?.price ?? 0;
  const usdc = data.USDC_USD?.price ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <div className="rounded-full bg-black/35 px-3 py-1 backdrop-blur border border-white/10">
        <span className="opacity-80">SOL/USD</span>{" "}
        <span className="font-semibold">${fmt(sol, 2)}</span>
      </div>

      <div className="rounded-full bg-black/35 px-3 py-1 backdrop-blur border border-white/10">
        <span className="opacity-80">USDC/USD</span>{" "}
        <span className="font-semibold">${fmt(usdc, 4)}</span>
      </div>
    </div>
  );
}
