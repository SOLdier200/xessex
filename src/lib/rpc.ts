/**
 * Server-side RPC helper with Gatekeeper primary + fallback.
 *
 * On mainnet (presale): uses HELIUS_RPC_PRIMARY (Gatekeeper) with
 * automatic fallback to HELIUS_RPC_FALLBACK on transient errors.
 *
 * On devnet (main site): falls back to SOLANA_RPC_URL / NEXT_PUBLIC_SOLANA_RPC_URL
 * or the public devnet endpoint.
 *
 * Usage:
 *   import { rpc } from "@/lib/rpc";
 *   const info = await rpc((c) => c.getAccountInfo(pubkey));
 */

import { Connection } from "@solana/web3.js";

function getPrimaryUrl(): string {
  return (
    process.env.HELIUS_RPC_PRIMARY ||
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.devnet.solana.com"
  );
}

function getFallbackUrl(): string | null {
  return process.env.HELIUS_RPC_FALLBACK || null;
}

let _connPrimary: Connection | null = null;
let _connFallback: Connection | null = null;
let _lastPrimary = "";
let _lastFallback = "";

export function connPrimary(): Connection {
  const url = getPrimaryUrl();
  if (!_connPrimary || _lastPrimary !== url) {
    _connPrimary = new Connection(url, "confirmed");
    _lastPrimary = url;
  }
  return _connPrimary;
}

export function connFallback(): Connection | null {
  const url = getFallbackUrl();
  if (!url) return null;
  if (!_connFallback || _lastFallback !== url) {
    _connFallback = new Connection(url, "confirmed");
    _lastFallback = url;
  }
  return _connFallback;
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
 * Execute an RPC call against the primary connection.
 * On transient failure, automatically retries against the fallback (if configured).
 */
export async function rpc<T>(fn: (c: Connection) => Promise<T>): Promise<T> {
  try {
    return await fn(connPrimary());
  } catch (e) {
    const fb = connFallback();
    if (!fb || !isTransient(e)) throw e;
    return await fn(fb);
  }
}
