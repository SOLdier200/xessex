/**
 * Calculate raffle win probability
 */

/**
 * Calculate probability of winning any of the 3 prizes
 *
 * Uses 1 - (1 - t/T)^3 approximation (without replacement)
 * Returns percentage (0-100) rounded to 2 decimals
 */
export function chanceAnyPrizePct(userTickets: bigint, totalTickets: bigint): number {
  if (totalTickets <= 0n || userTickets <= 0n) return 0;

  // Safe for typical ranges. If you ever get insane totals, we can swap to a bigint-safe approximation.
  const t = Number(userTickets);
  const T = Number(totalTickets);
  if (!Number.isFinite(t) || !Number.isFinite(T) || T <= 0) return 0;

  const p = 1 - Math.pow(1 - t / T, 3); // 3 prizes, without replacement approximation
  const pct = Math.max(0, Math.min(1, p)) * 100;
  return Math.round(pct * 100) / 100; // 2 decimals
}
