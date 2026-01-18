/**
 * Epoch builder for XESS claim system.
 * Builds merkle tree from claimable rewards and stores in DB.
 *
 * Weekly epochs: Sunday midnight PT
 * Source: RewardEvent with status=PAID and claimedAt=null
 *
 * IMPORTANT: amountAtomic in ClaimLeaf uses 9 decimals (matches token mint).
 * The computeClaimablesForWeek function handles 6→9 decimal conversion.
 */

import { db } from "@/lib/prisma";
import { computeClaimablesForWeek } from "@/lib/claimables";
import { buildMerkle, getProof, leafHash, toHex32 } from "@/lib/merkleSha256";

export type BuildEpochResult = {
  ok: boolean;
  alreadyExists: boolean;
  epoch: number;
  weekKey: string;
  rootHex: string;
  leafCount?: number;
  totalAtomic?: string;
};

/**
 * Build and store a claim epoch for a specific week.
 *
 * @param epoch - Sequential epoch number
 * @param weekKey - Week identifier (e.g., "2026-01-18" for Sunday Jan 18)
 */
export async function buildAndStoreClaimEpoch(args: {
  epoch: number;
  weekKey: string;
}): Promise<BuildEpochResult> {
  const { epoch, weekKey } = args;

  // Check if epoch or weekKey already exists
  const existing = await db.claimEpoch.findFirst({
    where: { OR: [{ epoch }, { weekKey }] },
  });

  if (existing) {
    return {
      ok: true,
      alreadyExists: true,
      epoch: existing.epoch,
      weekKey: existing.weekKey,
      rootHex: existing.rootHex,
    };
  }

  // Compute claimables from RewardEvent
  const rows = await computeClaimablesForWeek(weekKey);

  if (rows.length === 0) {
    throw new Error(`No claimables for weekKey=${weekKey}`);
  }

  // Deterministic ordering (CRITICAL for reproducible merkle tree)
  // Sort by wallet (base58), then userId as tiebreaker
  rows.sort((a, b) => {
    const walletCmp = a.wallet.localeCompare(b.wallet);
    if (walletCmp !== 0) return walletCmp;
    return a.userId.localeCompare(b.userId);
  });

  // Build leaf hashes
  const leafBuffers = rows.map((r, index) =>
    leafHash({
      wallet: r.wallet,
      epoch: BigInt(epoch),
      amountAtomic: r.amountAtomic,
      index,
    })
  );

  const { root, layers } = buildMerkle(leafBuffers);
  const rootHex = toHex32(root);

  const totalAtomic = rows.reduce((acc, r) => acc + r.amountAtomic, 0n);

  // Write epoch + leaves in one transaction
  await db.$transaction(async (tx) => {
    await tx.claimEpoch.create({
      data: {
        epoch,
        weekKey,
        rootHex,
        totalAtomic,
        leafCount: rows.length,
      },
    });

    for (let i = 0; i < rows.length; i++) {
      const proofHex = getProof(layers, i).map(toHex32);
      await tx.claimLeaf.create({
        data: {
          epoch,
          weekKey,
          userId: rows[i].userId,
          wallet: rows[i].wallet,
          index: i,
          amountAtomic: rows[i].amountAtomic,
          proofHex,
        },
      });
    }
  });

  return {
    ok: true,
    alreadyExists: false,
    epoch,
    weekKey,
    rootHex,
    leafCount: rows.length,
    totalAtomic: totalAtomic.toString(),
  };
}

/**
 * Get the latest epoch from DB.
 */
export async function getLatestEpoch() {
  return db.claimEpoch.findFirst({
    orderBy: { epoch: "desc" },
  });
}

/**
 * Get a user's leaf for a specific epoch by wallet.
 */
export async function getLeafByWallet(epoch: number, wallet: string) {
  return db.claimLeaf.findUnique({
    where: { epoch_wallet: { epoch, wallet } },
  });
}

/**
 * Get a user's leaf for a specific week by wallet.
 */
export async function getLeafByWeekAndWallet(weekKey: string, wallet: string) {
  return db.claimLeaf.findUnique({
    where: { weekKey_wallet: { weekKey, wallet } },
  });
}
