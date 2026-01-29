/**
 * Epoch builder for XESS claim system.
 * Builds merkle tree from claimable rewards and stores in DB.
 *
 * Weekly epochs: Sunday midnight PT
 * Source: RewardEvent with status=PAID and claimedAt=null
 *
 * IMPORTANT: amountAtomic in ClaimLeaf uses 9 decimals (matches token mint).
 * The computeClaimablesForWeek function handles 6→9 decimal conversion.
 *
 * V1: Wallet-based leaves (requires linked wallet)
 * V2: UserKey-based leaves (no wallet required, claim to any wallet at claim time)
 */

import { db } from "@/lib/prisma";
import {
  computeClaimablesForWeek,
  computeClaimablesForWeekV2,
  DIAMOND_REWARD_TYPES,
  ALL_REWARD_TYPES,
} from "@/lib/claimables";
import { RewardType } from "@prisma/client";
import {
  buildMerkle,
  getProof,
  leafHash,
  leafHashV2,
  toHex32,
  userKey32FromUserId,
  generateSalt32,
} from "@/lib/merkleSha256";
import crypto from "crypto";

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
  rewardTypes?: RewardType[];
}): Promise<BuildEpochResult> {
  const { epoch, weekKey, rewardTypes } = args;

  // Check if epoch or weekKey already exists
  const existing = await db.claimEpoch.findFirst({
    where: {
      OR: [
        { epoch },
        { weekKey, version: 1 },
      ],
    },
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
  const rows = await computeClaimablesForWeek(weekKey, rewardTypes ?? DIAMOND_REWARD_TYPES);

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
        version: 1,
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
  return db.claimLeaf.findFirst({
    where: { weekKey, wallet },
  });
}

// ==================== V2 Epoch Builder (UserKey-based) ====================

export type BuildEpochResultV2 = {
  ok: boolean;
  alreadyExists: boolean;
  immutable: boolean; // true if setOnChain=true and cannot rebuild
  epoch: number;
  weekKey: string;
  version: 2;
  rootHex: string;
  buildHash?: string;
  leafCount?: number;
  totalAtomic?: string;
};

/**
 * Compute a stable buildHash from the inputs.
 * This allows detecting if inputs have changed since last build.
 * Format: SHA256(epoch|weekKey|sorted(userId:amountAtomic)...)
 */
function computeBuildHash(
  epoch: number,
  weekKey: string,
  rows: Array<{ userId: string; amountAtomic: bigint }>
): string {
  const sorted = [...rows].sort((a, b) => a.userId.localeCompare(b.userId));
  const parts = sorted.map(r => `${r.userId}:${r.amountAtomic.toString()}`);
  const input = `${epoch}|${weekKey}|${parts.join(",")}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * V2: Build and store a claim epoch using userKey-based leaves.
 *
 * Features:
 * - No wallet requirement (users earn rewards without linking wallet)
 * - Per-(epoch, user) salt stored in ClaimSalt table
 * - buildHash for idempotency (detect if inputs changed)
 * - Immutability guard when setOnChain=true
 * - Supports rebuild-until-published pattern
 *
 * @param epoch - Sequential epoch number
 * @param weekKey - Week identifier (e.g., "2026-01-18" for Sunday Jan 18)
 */
export async function buildClaimEpochV2Safe(args: {
  epoch: number;
  weekKey: string;
  rewardTypes?: RewardType[];
}): Promise<BuildEpochResultV2> {
  const { epoch, weekKey, rewardTypes } = args;

  // Check existing epoch
  const existing = await db.claimEpoch.findFirst({
    where: {
      OR: [
        { epoch },
        { weekKey, version: 2 },
      ],
    },
  });

  // Immutability guard: if on-chain, cannot rebuild
  if (existing?.setOnChain) {
    return {
      ok: true,
      alreadyExists: true,
      immutable: true,
      epoch: existing.epoch,
      weekKey: existing.weekKey,
      version: 2,
      rootHex: existing.rootHex,
      buildHash: existing.buildHash ?? undefined,
    };
  }

  // Compute claimables (V2 - all reward types for free model)
  const rows = await computeClaimablesForWeekV2(weekKey, rewardTypes ?? ALL_REWARD_TYPES);

  if (rows.length === 0) {
    throw new Error(`No claimables for weekKey=${weekKey}`);
  }

  // Compute buildHash to detect input changes
  const buildHash = computeBuildHash(epoch, weekKey, rows);

  // If epoch exists with same buildHash, return existing (true idempotency)
  if (existing && existing.buildHash === buildHash && existing.version === 2) {
    return {
      ok: true,
      alreadyExists: true,
      immutable: false,
      epoch: existing.epoch,
      weekKey: existing.weekKey,
      version: 2,
      rootHex: existing.rootHex,
      buildHash,
    };
  }

  // Deterministic ordering (CRITICAL for reproducible merkle tree)
  // Sort by userId for consistency
  rows.sort((a, b) => a.userId.localeCompare(b.userId));

  // Get or create salts for each user
  const saltMap = new Map<string, Buffer>();
  const userKeyMap = new Map<string, Buffer>();

  for (const row of rows) {
    const userKey32 = userKey32FromUserId(row.userId);
    userKeyMap.set(row.userId, userKey32);

    // Check if salt already exists for this (epoch, user)
    const existingSalt = await db.claimSalt.findUnique({
      where: { epoch_userId: { epoch, userId: row.userId } },
    });

    if (existingSalt) {
      saltMap.set(row.userId, Buffer.from(existingSalt.claimSaltHex, "hex"));
    } else {
      // Generate new salt
      const salt32 = generateSalt32();
      saltMap.set(row.userId, salt32);

      // Store the salt
      await db.claimSalt.create({
        data: {
          epoch,
          userId: row.userId,
          userKeyHex: toHex32(userKey32),
          claimSaltHex: toHex32(salt32),
        },
      });
    }
  }

  // Build leaf hashes (V2 format)
  const leafBuffers = rows.map((r, index) => {
    const userKey32 = userKeyMap.get(r.userId)!;
    const salt32 = saltMap.get(r.userId)!;
    return leafHashV2({
      userKey32,
      epoch: BigInt(epoch),
      amountAtomic: r.amountAtomic,
      index,
      salt32,
    });
  });

  const { root, layers } = buildMerkle(leafBuffers);
  const rootHex = toHex32(root);

  const totalAtomic = rows.reduce((acc, r) => acc + r.amountAtomic, 0n);

  // Write epoch + leaves in transaction
  await db.$transaction(async (tx) => {
    // Delete existing epoch and leaves if rebuilding
    if (existing) {
      await tx.claimLeaf.deleteMany({ where: { epoch } });
      await tx.claimEpoch.delete({ where: { epoch } });
    }

    await tx.claimEpoch.create({
      data: {
        epoch,
        weekKey,
        rootHex,
        totalAtomic,
        leafCount: rows.length,
        version: 2,
        buildHash,
      },
    });

    for (let i = 0; i < rows.length; i++) {
      const proofHex = getProof(layers, i).map(toHex32);
      const userKey32 = userKeyMap.get(rows[i].userId)!;
      const salt32 = saltMap.get(rows[i].userId)!;

      await tx.claimLeaf.create({
        data: {
          epoch,
          weekKey,
          userId: rows[i].userId,
          wallet: null, // V2 doesn't use wallet
          index: i,
          amountAtomic: rows[i].amountAtomic,
          proofHex,
          userKeyHex: toHex32(userKey32),
          claimSaltHex: toHex32(salt32),
        },
      });
    }
  });

  return {
    ok: true,
    alreadyExists: false,
    immutable: false,
    epoch,
    weekKey,
    version: 2,
    rootHex,
    buildHash,
    leafCount: rows.length,
    totalAtomic: totalAtomic.toString(),
  };
}

/**
 * Get a user's V2 leaf for a specific epoch by userKeyHex.
 */
export async function getLeafByUserKey(epoch: number, userKeyHex: string) {
  return db.claimLeaf.findUnique({
    where: { epoch_userKeyHex: { epoch, userKeyHex } },
  });
}

/**
 * Get a user's leaf for a specific epoch by userId.
 */
export async function getLeafByUserId(epoch: number, userId: string) {
  return db.claimLeaf.findFirst({
    where: { epoch, userId },
  });
}
