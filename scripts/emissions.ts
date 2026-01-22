/**
 * Weekly emission schedule with decay for XESS rewards
 *
 * Decay Model B:
 * - Weeks 1-13: 1,000,000 XESS/week
 * - Weeks 14-40: 750,000 XESS/week
 * - Weeks 41-79: 500,000 XESS/week
 * - Week 80+: 250,000 XESS/week
 */

import { toAtomic } from "./xessMath";

export function weeklyEmissionAtomic(weekIndex: number): bigint {
  // weekIndex is 0-based from launch
  if (weekIndex < 13) return toAtomic(1_000_000);
  if (weekIndex < 40) return toAtomic(750_000);
  if (weekIndex < 79) return toAtomic(500_000);
  return toAtomic(250_000);
}

/**
 * Calculate total emissions for a range of weeks
 */
export function totalEmissionsForWeeks(startWeek: number, endWeek: number): bigint {
  let total = 0n;
  for (let w = startWeek; w <= endWeek; w++) {
    total += weeklyEmissionAtomic(w);
  }
  return total;
}
