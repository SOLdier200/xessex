/**
 * XESS token balance utilities for Solana
 *
 * Includes a 30-second TTL cache to avoid hammering RPC on repeated calls
 * (e.g. /api/auth/me + /api/wallet/balances + /api/profile all fire on page load).
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getRpcUrl(): string {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com"
  );
}

function getXessMint(): PublicKey {
  const mint = process.env.XESS_MINT;
  if (!mint) throw new Error("XESS_MINT environment variable not set");
  return new PublicKey(mint);
}

let cachedConnection: Connection | null = null;

function getConnection(): Connection {
  if (!cachedConnection) {
    cachedConnection = new Connection(getRpcUrl(), "confirmed");
  }
  return cachedConnection;
}

// ---------------------------------------------------------------------------
// Balance cache — 30-second TTL per wallet
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  value: bigint | null;
  ts: number;
}

const balanceCache = new Map<string, CacheEntry>();

function getCached(wallet: string): bigint | null | undefined {
  const entry = balanceCache.get(wallet);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    balanceCache.delete(wallet);
    return undefined;
  }
  return entry.value;
}

function setCache(wallet: string, value: bigint | null) {
  balanceCache.set(wallet, { value, ts: Date.now() });
  // Evict stale entries periodically (keep map bounded)
  if (balanceCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of balanceCache) {
      if (now - v.ts > CACHE_TTL_MS) balanceCache.delete(k);
    }
  }
}

// ---------------------------------------------------------------------------
// Retry helper — exponential backoff for transient RPC errors
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransient(e: unknown): boolean {
  const msg = String((e as Error)?.message || e);
  return (
    msg.includes("429") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("fetch failed") ||
    msg.toLowerCase().includes("network")
  );
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (!isTransient(e) || attempt === maxRetries) throw e;
      const delay = 500 * Math.pow(2, attempt); // 500, 1000, 2000
      await sleep(delay);
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Single-wallet balance (cached + retry)
// ---------------------------------------------------------------------------

/**
 * Get the XESS balance for a wallet address in atomic units (9 decimals).
 * Results are cached for 30 seconds to reduce RPC pressure.
 * Returns 0n if the token account doesn't exist, null on RPC failure.
 */
export async function getXessAtomicBalance(wallet: string): Promise<bigint | null> {
  // Check cache first
  const cached = getCached(wallet);
  if (cached !== undefined) return cached;

  try {
    const result = await withRetry(async () => {
      const connection = getConnection();
      const walletPubkey = new PublicKey(wallet);
      const xessMint = getXessMint();
      const ata = getAssociatedTokenAddressSync(xessMint, walletPubkey);

      const accountInfo = await connection.getAccountInfo(ata);
      if (!accountInfo) return 0n;

      // Parse balance directly from account data (avoids a second RPC call)
      const data = accountInfo.data;
      if (data.length >= 72) {
        return data.readBigUInt64LE(64);
      }

      return 0n;
    });

    setCache(wallet, result);
    return result;
  } catch (error) {
    console.error(`[xessBalance] Error getting balance for ${wallet}:`, error);
    setCache(wallet, null);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Batch balance (cached + retry per batch)
// ---------------------------------------------------------------------------

/**
 * Get XESS balances for multiple wallets in batch.
 * Uses getMultipleAccountsInfo for efficiency (1 RPC call per 100 wallets).
 * Cached results are returned from cache; only uncached wallets hit RPC.
 */
export async function getXessAtomicBalances(
  wallets: string[]
): Promise<Map<string, bigint | null>> {
  const results = new Map<string, bigint | null>();
  if (wallets.length === 0) return results;

  // Separate cached vs uncached
  const uncachedWallets: string[] = [];
  for (const wallet of wallets) {
    const cached = getCached(wallet);
    if (cached !== undefined) {
      results.set(wallet, cached);
    } else {
      uncachedWallets.push(wallet);
    }
  }

  if (uncachedWallets.length === 0) return results;

  const connection = getConnection();
  const xessMint = getXessMint();

  // Derive all ATAs for uncached wallets
  const ataToWallet = new Map<string, string>();
  const atas: PublicKey[] = [];

  for (const wallet of uncachedWallets) {
    try {
      const walletPubkey = new PublicKey(wallet);
      const ata = getAssociatedTokenAddressSync(xessMint, walletPubkey);
      atas.push(ata);
      ataToWallet.set(ata.toBase58(), wallet);
    } catch {
      results.set(wallet, 0n);
      setCache(wallet, 0n);
    }
  }

  const BATCH_SIZE = 100;
  for (let i = 0; i < atas.length; i += BATCH_SIZE) {
    const batch = atas.slice(i, i + BATCH_SIZE);

    try {
      const accounts = await withRetry(() =>
        connection.getMultipleAccountsInfo(batch)
      );

      for (let j = 0; j < batch.length; j++) {
        const ata = batch[j];
        const wallet = ataToWallet.get(ata.toBase58())!;
        const accountInfo = accounts[j];

        if (!accountInfo) {
          results.set(wallet, 0n);
          setCache(wallet, 0n);
          continue;
        }

        try {
          const data = accountInfo.data;
          if (data.length >= 72) {
            const amount = data.readBigUInt64LE(64);
            results.set(wallet, amount);
            setCache(wallet, amount);
          } else {
            results.set(wallet, 0n);
            setCache(wallet, 0n);
          }
        } catch {
          results.set(wallet, 0n);
          setCache(wallet, 0n);
        }
      }
    } catch (error) {
      console.error(`[xessBalance] Batch fetch error:`, error);
      for (const ata of batch) {
        const wallet = ataToWallet.get(ata.toBase58());
        if (wallet) {
          results.set(wallet, null);
          setCache(wallet, null);
        }
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatXess(atomicBalance: bigint, decimals = 2): string {
  const whole = atomicBalance / 1_000_000_000n;
  const frac = atomicBalance % 1_000_000_000n;

  if (decimals === 0) {
    return whole.toString();
  }

  const fracStr = frac.toString().padStart(9, "0").slice(0, decimals);
  return `${whole}.${fracStr}`;
}
