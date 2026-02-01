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
 * Scans linearly to handle gaps in epoch numbers (e.g., 1-15, 17, 18).
 */
export async function getMaxEpochOnChain(maxScan = DEFAULT_MAX_SCAN): Promise<number> {
  const connection = new Connection(RPC_URL, "confirmed");

  if (!(await epochExists(connection, 1))) {
    return 0;
  }

  let maxFound = 1;
  let consecutiveGaps = 0;
  const MAX_GAPS = 10; // Stop after 10 consecutive missing epochs

  for (let i = 2; i <= maxScan; i++) {
    if (await epochExists(connection, i)) {
      maxFound = i;
      consecutiveGaps = 0;
    } else {
      consecutiveGaps++;
      if (consecutiveGaps >= MAX_GAPS) {
        break; // Stop scanning after 10 consecutive gaps
      }
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

