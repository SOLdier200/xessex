/**
 * Special Credits tier system based on XESS holdings
 *
 * Tiers determine monthly credit accrual rate.
 * Credits are distributed daily with fractional carry-over.
 */

import { XESS_MULTIPLIER, CREDIT_MICRO } from "./rewardsConstants";

// Tier definitions: [minBalance (XESS), monthlyCredits]
// Tier 0 = no tier (below minimum)
// Tiers 1-9 = increasing benefits
export const TIER_TABLE: { minBalance: bigint; monthlyCredits: bigint }[] = [
  { minBalance: 0n, monthlyCredits: 0n },                               // Tier 0: Below 10k → 0 credits/mo
  { minBalance: 10_000n * XESS_MULTIPLIER, monthlyCredits: 40n },       // Tier 1: 10k XESS → 40 credits/mo
  { minBalance: 25_000n * XESS_MULTIPLIER, monthlyCredits: 120n },      // Tier 2: 25k XESS → 120 credits/mo
  { minBalance: 50_000n * XESS_MULTIPLIER, monthlyCredits: 240n },      // Tier 3: 50k XESS → 240 credits/mo
  { minBalance: 100_000n * XESS_MULTIPLIER, monthlyCredits: 800n },     // Tier 4: 100k XESS → 800 credits/mo
  { minBalance: 250_000n * XESS_MULTIPLIER, monthlyCredits: 2_000n },   // Tier 5: 250k XESS → 2,000 credits/mo
  { minBalance: 500_000n * XESS_MULTIPLIER, monthlyCredits: 4_000n },   // Tier 6: 500k XESS → 4,000 credits/mo
  { minBalance: 1_000_000n * XESS_MULTIPLIER, monthlyCredits: 8_000n }, // Tier 7: 1M XESS → 8,000 credits/mo
  { minBalance: 2_500_000n * XESS_MULTIPLIER, monthlyCredits: 12_000n }, // Tier 8: 2.5M XESS → 12,000 credits/mo
  { minBalance: 5_000_000n * XESS_MULTIPLIER, monthlyCredits: 16_000n }, // Tier 9: 5M XESS → 16,000 credits/mo
];

/**
 * Get the tier index for a given XESS balance (in atomic units)
 * Returns 0-7 where 0 means below minimum threshold
 */
export function getTierFromBalance(balanceAtomic: bigint): number {
  // Find the highest tier the balance qualifies for
  for (let i = TIER_TABLE.length - 1; i >= 0; i--) {
    if (balanceAtomic >= TIER_TABLE[i].minBalance) {
      return i;
    }
  }
  return 0;
}

/**
 * Get monthly credits for a tier (in whole credits, not microcredits)
 */
export function getMonthlyCreditsForTier(tier: number): bigint {
  if (tier < 0 || tier >= TIER_TABLE.length) return 0n;
  return TIER_TABLE[tier].monthlyCredits;
}

/**
 * Get tier info including human-readable details
 */
export function getTierInfo(tier: number) {
  const tierData = TIER_TABLE[tier] || TIER_TABLE[0];
  return {
    tier,
    minBalanceXess: Number(tierData.minBalance / XESS_MULTIPLIER),
    monthlyCredits: Number(tierData.monthlyCredits),
    nextTier: tier < TIER_TABLE.length - 1 ? tier + 1 : null,
    nextTierMinXess: tier < TIER_TABLE.length - 1
      ? Number(TIER_TABLE[tier + 1].minBalance / XESS_MULTIPLIER)
      : null,
  };
}

/**
 * Calculate daily accrual in microcredits with carry-over
 *
 * @param tier - Current tier (0-7)
 * @param carryMicro - Fractional microcredits carried from previous day
 * @param daysInMonth - Number of days in the current month
 * @returns Object with daily microcredits to add and new carry amount
 */
export function calculateDailyAccrual(
  tier: number,
  carryMicro: bigint,
  daysInMonth: number
): { dailyMicro: bigint; newCarryMicro: bigint } {
  const monthlyCredits = getMonthlyCreditsForTier(tier);
  if (monthlyCredits === 0n) {
    return { dailyMicro: 0n, newCarryMicro: 0n };
  }

  // Convert monthly credits to monthly microcredits
  const monthlyMicro = monthlyCredits * CREDIT_MICRO;

  // Calculate daily rate: (monthlyMicro + carryMicro) / daysInMonth
  // We add carry first to properly distribute fractional amounts
  const totalMicro = monthlyMicro + carryMicro * BigInt(daysInMonth);
  const dailyMicro = totalMicro / BigInt(daysInMonth);

  // Calculate new carry: the remainder after distributing daily amount
  // This ensures no microcredits are lost due to integer division
  const newCarryMicro = totalMicro % BigInt(daysInMonth);

  return { dailyMicro, newCarryMicro };
}

/**
 * Simple daily accrual without carry (for simpler calculations)
 * Returns microcredits per day
 */
export function getSimpleDailyMicro(tier: number, daysInMonth: number): bigint {
  const monthlyCredits = getMonthlyCreditsForTier(tier);
  if (monthlyCredits === 0n) return 0n;

  const monthlyMicro = monthlyCredits * CREDIT_MICRO;
  return monthlyMicro / BigInt(daysInMonth);
}

/**
 * Get the number of days in a given month
 */
export function getDaysInMonth(year: number, month: number): number {
  // month is 1-indexed (1 = January)
  return new Date(year, month, 0).getDate();
}

/**
 * Format credits for display (microcredits → credits with decimals)
 */
export function formatCredits(microCredits: bigint): string {
  const credits = Number(microCredits) / Number(CREDIT_MICRO);
  if (credits === Math.floor(credits)) {
    return credits.toFixed(0);
  }
  return credits.toFixed(2);
}

/**
 * Convert whole credits to microcredits
 */
export function creditsToMicro(credits: number | bigint): bigint {
  return BigInt(credits) * CREDIT_MICRO;
}

/**
 * Convert microcredits to whole credits (truncates)
 */
export function microToCredits(microCredits: bigint): bigint {
  return microCredits / CREDIT_MICRO;
}
