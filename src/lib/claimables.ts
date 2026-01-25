/**
 * Claimables aggregator for XESS claim system.
 * Computes claimable amounts per user for a given weekKey.
 *
 * Source of truth: RewardEvent with status=PAID and claimedAt=null
 *
 * IMPORTANT: Unit conversion
 * - RewardEvent.amount is stored with 6 decimals (from weekly-distribute emission schedule)
 * - XESS token mint has 9 decimals
 * - ClaimLeaf.amountAtomic must be 9 decimals for on-chain transfers
 * - Conversion: atomic9 = atomic6 * 1000n
 */

import { db } from "@/lib/prisma";

// Decimal precision constants
export const REWARD_EVENT_DECIMALS = 6n;  // RewardEvent.amount uses 6 decimals
export const MINT_DECIMALS = 9n;          // XESS token mint uses 9 decimals
export const DECIMALS_MULT = 10n ** (MINT_DECIMALS - REWARD_EVENT_DECIMALS); // 1000n

/**
 * Convert 6-decimal amount (RewardEvent storage) to 9-decimal atomic units (token mint).
 */
export function toMintAtomic(amount6: bigint): bigint {
  return amount6 * DECIMALS_MULT;
}

export type ClaimableRow = {
  userId: string;
  wallet: string;        // base58
  amountAtomic: bigint;  // 9-decimal atomic units (matches token mint)
};

/**
 * Compute claimable amounts for a specific week.
 * Sums RewardEvent.amount where:
 *   - weekKey matches
 *   - status = PAID (earned/owed)
 *   - claimedAt is null (not yet claimed)
 *
 * Returns amounts in 9-decimal atomic units (converted from 6-decimal storage).
 */
export async function computeClaimablesForWeek(weekKey: string): Promise<ClaimableRow[]> {
  // Group by userId and sum amounts (stored in 6-decimal units)
  const grouped = await db.rewardEvent.groupBy({
    by: ["userId"],
    where: {
      weekKey,
      status: "PAID",
      claimedAt: null,
    },
    _sum: { amount: true },
  });

  if (grouped.length === 0) return [];

  // Fetch wallets for these users
  const userIds = grouped.map(g => g.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, solWallet: true, walletAddress: true },
  });

  const walletByUser = new Map(
    users.map(u => [u.id, (u.solWallet || u.walletAddress || "").trim()])
  );

  // Convert to leaf rows with 6->9 decimal conversion
  const rows: ClaimableRow[] = grouped
    .map(g => {
      const wallet = walletByUser.get(g.userId) || "";
      const amount6 = BigInt((g._sum.amount as bigint) ?? 0n);
      const amountAtomic = amount6 * DECIMALS_MULT; // convert 6 -> 9 decimals
      return { userId: g.userId, wallet, amountAtomic };
    })
    .filter(r => r.wallet && r.amountAtomic > 0n);

  return rows;
}

/**
 * Get all unclaimed rewards for a user in a specific week.
 * Used for marking as claimed after successful on-chain claim.
 *
 * Note: amount is in 6-decimal units (as stored in RewardEvent).
 * Use toMintAtomic() to convert if needed for on-chain operations.
 */
export async function getUnclaimedRewardsForUserWeek(userId: string, weekKey: string) {
  return db.rewardEvent.findMany({
    where: {
      userId,
      weekKey,
      status: "PAID",
      claimedAt: null,
    },
    select: { id: true, amount: true },
  });
}

// ==================== V2 Claimables (no wallet required) ====================

export type ClaimableRowV2 = {
  userId: string;
  amountAtomic: bigint;  // 9-decimal atomic units (matches token mint)
};

/**
 * V2: Compute claimable amounts for a specific week WITHOUT wallet requirement.
 * Sums RewardEvent.amount where:
 *   - weekKey matches
 *   - status = PAID (earned/owed)
 *   - claimedAt is null (not yet claimed)
 *
 * Returns amounts in 9-decimal atomic units (converted from 6-decimal storage).
 * Users do NOT need a linked wallet to be included.
 */
export async function computeClaimablesForWeekV2(weekKey: string): Promise<ClaimableRowV2[]> {
  // Group by userId and sum amounts (stored in 6-decimal units)
  const grouped = await db.rewardEvent.groupBy({
    by: ["userId"],
    where: {
      weekKey,
      status: "PAID",
      claimedAt: null,
    },
    _sum: { amount: true },
  });

  if (grouped.length === 0) return [];

  // Convert to rows with 6->9 decimal conversion (no wallet filter)
  const rows: ClaimableRowV2[] = grouped
    .map(g => {
      const amount6 = BigInt((g._sum.amount as bigint) ?? 0n);
      const amountAtomic = amount6 * DECIMALS_MULT; // convert 6 -> 9 decimals
      return { userId: g.userId, amountAtomic };
    })
    .filter(r => r.amountAtomic > 0n);

  return rows;
}
