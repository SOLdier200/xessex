/**
 * Server-side RPC helper.
 *
 * Two connection types:
 *   connSend()  – Gatekeeper (HELIUS_RPC_PRIMARY) for sending txs.
 *                 Send-only; does NOT support reads or preflight.
 *   connRead()  – Standard endpoint (HELIUS_RPC_FALLBACK) for reads,
 *                 getParsedTransaction, getAccountInfo, etc.
 *                 Falls back to primary if no fallback is configured
 *                 (e.g. on devnet where there's only one endpoint).
 *
 * rpc() helper: runs reads against connRead(), falls back to connSend()
 * on transient errors.
 *
 * On devnet (main site): only SOLANA_RPC_URL / NEXT_PUBLIC_SOLANA_RPC_URL
 * is set, so connRead() and connSend() resolve to the same endpoint.
 *
 * Usage:
 *   import { rpc, connRead, connSend } from "@/lib/rpc";
 *   const info = await rpc((c) => c.getAccountInfo(pubkey));
 *   const sig = await sendAndConfirmTransaction(connSend(), tx, [kp]);
 */

import { Connection } from "@solana/web3.js";

function getGatekeeperUrl(): string {
  return (
    process.env.HELIUS_RPC_PRIMARY ||
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.devnet.solana.com"
  );
}

function getStandardUrl(): string {
  return (
    process.env.HELIUS_RPC_FALLBACK ||
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.devnet.solana.com"
  );
}

let _connSend: Connection | null = null;
let _connRead: Connection | null = null;
let _lastSend = "";
let _lastRead = "";

/** Gatekeeper endpoint — for sending transactions only. */
export function connSend(): Connection {
  const url = getGatekeeperUrl();
  if (!_connSend || _lastSend !== url) {
    _connSend = new Connection(url, "confirmed");
    _lastSend = url;
  }
  return _connSend;
}

/** Standard endpoint — for reads, getParsedTransaction, getAccountInfo, etc. */
export function connRead(): Connection {
  const url = getStandardUrl();
  if (!_connRead || _lastRead !== url) {
    _connRead = new Connection(url, "confirmed");
    _lastRead = url;
  }
  return _connRead;
}

// Backwards compat aliases
export const connPrimary = connSend;
export const connFallback = (): Connection | null => {
  const url = process.env.HELIUS_RPC_FALLBACK;
  return url ? connRead() : null;
};

/** Expose raw URLs so callers can detect Gatekeeper vs standard. */
export function rpcUrls() {
  return {
    send: getGatekeeperUrl(),
    read: getStandardUrl(),
  };
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

/**
 * Sleep helper for backoff delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Execute a read RPC call with exponential backoff on transient errors.
 * Retries up to 4 times: 500ms → 1s → 2s → 4s before giving up.
 * On final failure, falls back to the Gatekeeper endpoint (if different).
 */
export async function rpc<T>(fn: (c: Connection) => Promise<T>): Promise<T> {
  const MAX_RETRIES = 4;
  let lastError: unknown;

  // Try connRead() with exponential backoff
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn(connRead());
    } catch (e) {
      lastError = e;
      if (!isTransient(e)) throw e;
      if (attempt < MAX_RETRIES) {
        const delay = 500 * Math.pow(2, attempt); // 500, 1000, 2000, 4000
        await sleep(delay);
      }
    }
  }

  // Final fallback: try Gatekeeper if it's a different endpoint
  const send = connSend();
  if (send !== connRead()) {
    return await fn(send);
  }

  throw lastError;
}
