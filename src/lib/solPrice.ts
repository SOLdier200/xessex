/**
 * Server-side SOL/USD price utility using Pyth Hermes
 *
 * - getSolPriceUsd(): fetches SOL/USD with 60s cache + 5s timeout
 * - computeLamportsPerXess(): pure BigInt math from USD price + SOL rate
 */

const HERMES_URL = process.env.PYTH_HERMES_URL || "https://hermes.pyth.network";
const SOL_USD_FEED =
  process.env.PYTH_SOL_USD_FEED_ID ||
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

const CACHE_TTL_MS = 60_000; // 60 seconds

let cachedPrice: number | null = null;
let cachedAt = 0;

/** Convert Pyth price+expo to a float */
function toReal(price: string, expo: number): number {
  return Number(price) * Math.pow(10, expo);
}

/**
 * Fetch SOL/USD from Pyth Hermes with 60s in-memory cache.
 * Returns stale cache if fetch fails. Returns null only if no cache exists.
 */
export async function getSolPriceUsd(): Promise<number | null> {
  const now = Date.now();
  if (cachedPrice !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedPrice;
  }

  try {
    const url = `${HERMES_URL}/v2/updates/price/latest?ids[]=${SOL_USD_FEED}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Hermes ${res.status}`);

    const json = await res.json();
    const parsed = json?.parsed;
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("No parsed price data");
    }

    const entry = parsed[0];
    const priceData = entry?.price;
    if (!priceData?.price || priceData.expo === undefined) {
      throw new Error("Invalid price structure");
    }

    const real = toReal(priceData.price, priceData.expo);
    if (real <= 0) throw new Error("SOL price <= 0");

    cachedPrice = real;
    cachedAt = now;
    return real;
  } catch (err) {
    console.error("Pyth SOL/USD fetch error:", err);
    // Return stale cache if available
    return cachedPrice;
  }
}

/**
 * Compute lamports per XESS token from USD micro-price and SOL/USD rate.
 *
 * Math: lamportsPerXess = (priceUsdMicros × 1e9) / round(solPriceUsd × 1e6)
 *
 * Example: $0.000039/XESS at $200/SOL
 *   = (39 × 1,000,000,000) / (200,000,000) = 195 lamports
 */
export function computeLamportsPerXess(
  priceUsdMicros: bigint,
  solPriceUsd: number,
): bigint {
  const solMicros = BigInt(Math.round(solPriceUsd * 1_000_000));
  if (solMicros === 0n) return 0n;
  return (priceUsdMicros * 1_000_000_000n) / solMicros;
}
