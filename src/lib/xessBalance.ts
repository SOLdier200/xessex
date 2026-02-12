/**
 * XESS token balance utilities for Solana
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// Lazy-load environment variables to avoid build-time issues
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

// Cached connection instance (single RPC endpoint)
let cachedConnection: Connection | null = null;

function getConnection(): Connection {
  if (!cachedConnection) {
    cachedConnection = new Connection(getRpcUrl(), "confirmed");
  }
  return cachedConnection;
}

/**
 * Get the XESS balance for a wallet address in atomic units (9 decimals)
 * Returns 0n if the token account doesn't exist, null on RPC failure
 *
 * @param wallet - Base58 Solana wallet address
 * @returns XESS balance in atomic units (bigint), or null if RPC failed
 */
export async function getXessAtomicBalance(wallet: string): Promise<bigint | null> {
  try {
    const connection = getConnection();
    const walletPubkey = new PublicKey(wallet);
    const xessMint = getXessMint();

    // Derive the Associated Token Account (ATA) address
    const ata = getAssociatedTokenAddressSync(xessMint, walletPubkey);

    // Check if ATA exists
    const accountInfo = await connection.getAccountInfo(ata);
    if (!accountInfo) {
      // No ATA = no balance
      return 0n;
    }

    // Get token balance
    const tokenBalance = await connection.getTokenAccountBalance(ata);

    // tokenBalance.value.amount is a string of the raw amount
    return BigInt(tokenBalance.value.amount);
  } catch (error) {
    console.error(`[xessBalance] Error getting balance for ${wallet}:`, error);
    return null;
  }
}

/**
 * Get XESS balances for multiple wallets in batch
 * More efficient than individual calls for large sets
 *
 * @param wallets - Array of base58 wallet addresses
 * @returns Map of wallet → atomic balance (null means RPC failure for that wallet)
 */
export async function getXessAtomicBalances(
  wallets: string[]
): Promise<Map<string, bigint | null>> {
  const results = new Map<string, bigint | null>();

  if (wallets.length === 0) return results;

  const connection = getConnection();
  const xessMint = getXessMint();

  // Derive all ATAs
  const ataToWallet = new Map<string, string>();
  const atas: PublicKey[] = [];

  for (const wallet of wallets) {
    try {
      const walletPubkey = new PublicKey(wallet);
      const ata = getAssociatedTokenAddressSync(xessMint, walletPubkey);
      atas.push(ata);
      ataToWallet.set(ata.toBase58(), wallet);
    } catch {
      // Invalid wallet address
      results.set(wallet, 0n);
    }
  }

  // Batch fetch account info (100 at a time to avoid RPC limits)
  const BATCH_SIZE = 100;
  for (let i = 0; i < atas.length; i += BATCH_SIZE) {
    const batch = atas.slice(i, i + BATCH_SIZE);

    try {
      const accounts = await connection.getMultipleAccountsInfo(batch);

      for (let j = 0; j < batch.length; j++) {
        const ata = batch[j];
        const wallet = ataToWallet.get(ata.toBase58())!;
        const accountInfo = accounts[j];

        if (!accountInfo) {
          results.set(wallet, 0n);
          continue;
        }

        // Parse SPL Token account data to get balance
        // Token account layout: ... + 64 bytes offset for amount (u64)
        try {
          // For SPL tokens, the amount is at offset 64 in the account data
          // It's a little-endian u64
          const data = accountInfo.data;
          if (data.length >= 72) {
            const amount = data.readBigUInt64LE(64);
            results.set(wallet, amount);
          } else {
            results.set(wallet, 0n);
          }
        } catch {
          results.set(wallet, 0n);
        }
      }
    } catch (error) {
      console.error(`[xessBalance] Batch fetch error:`, error);
      // Set null for all wallets in failed batch — callers must handle unknown balances
      for (const ata of batch) {
        const wallet = ataToWallet.get(ata.toBase58());
        if (wallet) results.set(wallet, null);
      }
    }
  }

  return results;
}

/**
 * Format atomic XESS balance to human-readable string
 */
export function formatXess(atomicBalance: bigint, decimals = 2): string {
  const whole = atomicBalance / 1_000_000_000n;
  const frac = atomicBalance % 1_000_000_000n;

  if (decimals === 0) {
    return whole.toString();
  }

  const fracStr = frac.toString().padStart(9, "0").slice(0, decimals);
  return `${whole}.${fracStr}`;
}
