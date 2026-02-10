/**
 * Pyth Price Proxy
 *
 * GET /api/pyth/prices
 * Returns SOL/USD and USDC/USD prices from Pyth Hermes.
 * Uses in-memory server-side cache to avoid hammering Hermes.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getHermesUrl() {
  return process.env.PYTH_HERMES_URL || "https://hermes.pyth.network";
}

function getSolFeedId() {
  return (
    process.env.PYTH_SOL_USD_FEED_ID ||
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
  );
}

function getUsdcFeedId() {
  return (
    process.env.PYTH_USDC_USD_FEED_ID ||
    "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"
  );
}

/** Normalize feed ID to "0x" + lowercase hex for consistent matching */
function normalizeFeedId(id: string): string {
  const s = (id || "").trim().toLowerCase();
  if (!s) return "";
  return s.startsWith("0x") ? s : `0x${s}`;
}

function toReal(price: string, expo: number): number {
  return Number(price) * Math.pow(10, expo);
}

type CacheEntry = {
  solUsd: { price: number; conf: number };
  usdcUsd: { price: number; conf: number };
  fetchedAt: number;
};

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

type HermesParsed = {
  id: string;
  price: {
    price: string;
    expo: number;
    conf: string;
    publish_time?: number;
  };
};

export async function GET() {
  const now = Date.now();

  // Serve warm cache
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(
      { ok: true, SOL_USD: cache.solUsd, USDC_USD: cache.usdcUsd },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  }

  try {
    const hermesUrl = getHermesUrl();
    const solFeed = normalizeFeedId(getSolFeedId());
    const usdcFeed = normalizeFeedId(getUsdcFeedId());

    const url = new URL("/v2/updates/price/latest", hermesUrl);
    url.searchParams.append("ids[]", solFeed);
    url.searchParams.append("ids[]", usdcFeed);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Hermes ${res.status}`);

    const json = await res.json();
    const parsed: HermesParsed[] = json?.parsed;

    if (!parsed || !Array.isArray(parsed) || parsed.length < 2) {
      throw new Error("Incomplete price data from Hermes");
    }

    const solEntry = parsed.find((p) => normalizeFeedId(p.id) === solFeed);
    const usdcEntry = parsed.find((p) => normalizeFeedId(p.id) === usdcFeed);

    if (!solEntry?.price?.price || !usdcEntry?.price?.price) {
      const ids = parsed.map((p) => p?.id).filter(Boolean);
      throw new Error(`Missing price entries. Got ids: ${ids.join(", ")}`);
    }

    const solUsd = {
      price: toReal(solEntry.price.price, solEntry.price.expo),
      conf: toReal(solEntry.price.conf, solEntry.price.expo),
    };

    const usdcUsd = {
      price: toReal(usdcEntry.price.price, usdcEntry.price.expo),
      conf: toReal(usdcEntry.price.conf, usdcEntry.price.expo),
    };

    cache = { solUsd, usdcUsd, fetchedAt: now };

    return NextResponse.json(
      { ok: true, SOL_USD: solUsd, USDC_USD: usdcUsd },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  } catch (err) {
    console.error("Pyth prices error:", err);

    // Return stale cache if available
    if (cache) {
      return NextResponse.json(
        { ok: true, SOL_USD: cache.solUsd, USDC_USD: cache.usdcUsd, stale: true },
        { headers: { "Cache-Control": "public, max-age=10" } },
      );
    }

    return NextResponse.json(
      { ok: false, error: "price_unavailable" },
      { status: 502 },
    );
  }
}
