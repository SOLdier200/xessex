import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.devnet.solana.com";

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_XESS_CLAIM_PROGRAM_ID ||
    "AKRLZssgxwQwC2gGgUtYtcU7JrhDyEfk1FHqQkZnFUax"
);

const DEFAULT_MAX_SCAN = 1024;

function u64LE(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

function epochRootPda(epoch: number) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("epoch_root"), u64LE(BigInt(epoch))],
    PROGRAM_ID
  )[0];
}

async function epochExists(connection: Connection, epoch: number): Promise<boolean> {
  const pda = epochRootPda(epoch);
  const info = await connection.getAccountInfo(pda, "confirmed");
  return !!info;
}

/**
 * Find the highest epoch that exists on-chain, or 0 if none.
 * Uses exponential + binary search to minimize RPC calls.
 */
export async function getMaxEpochOnChain(maxScan = DEFAULT_MAX_SCAN): Promise<number> {
  const connection = new Connection(RPC_URL, "confirmed");

  if (!(await epochExists(connection, 1))) {
    return 0;
  }

  let lo = 1;
  let hi = 2;

  while (hi <= maxScan && (await epochExists(connection, hi))) {
    lo = hi;
    hi *= 2;
  }

  if (hi > maxScan) {
    hi = maxScan + 1;
  }

  let left = lo + 1;
  let right = Math.min(hi - 1, maxScan);
  let maxFound = lo;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (await epochExists(connection, mid)) {
      maxFound = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return maxFound;
}

/**
 * Choose a safe next epoch number using both DB and on-chain state.
 */
export async function getNextEpochNumber(dbLatestEpoch?: number | null, maxScan?: number) {
  const chainLatest = await getMaxEpochOnChain(maxScan);
  const base = Math.max(dbLatestEpoch ?? 0, chainLatest ?? 0);
  return base + 1;
}

