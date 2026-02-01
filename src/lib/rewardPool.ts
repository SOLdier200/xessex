/**
 * Shared helpers for pool-aware rewards tracking
 * Used across all action routes to determine EMBED vs XESSEX pool
 */

import { StatPool } from "@prisma/client";

/**
 * Convert Video.kind to StatPool
 * Default to EMBED for any non-XESSEX content
 */
export function poolFromVideoKind(kind: string | null | undefined): StatPool {
  return kind === "XESSEX" ? "XESSEX" : "EMBED";
}

/**
 * Get start-of-day in UTC for daily active tracking
 */
export function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Flat-rate reward amounts in 6-decimal XESS
 * These are the per-action payouts for the flat layer
 */
export const FLAT_RATES = {
  EMBED: {
    RATING: 5_000_000n,           // 5 XESS
    COMMENT: 25_000_000n,         // 25 XESS
    LIKE_RECEIVED: 2_000_000n,    // 2 XESS
    COMMENT_SOURCED: 15_000_000n, // 15 XESS
    DAILY_ACTIVE: 100_000_000n,   // 100 XESS (weekly bonus)
  },
  XESSEX: {
    RATING: 20_000_000n,          // 20 XESS
    COMMENT: 50_000_000n,         // 50 XESS
    LIKE_RECEIVED: 5_000_000n,    // 5 XESS
    COMMENT_SOURCED: 45_000_000n, // 45 XESS
    DAILY_ACTIVE: 100_000_000n,   // 100 XESS (weekly bonus)
  },
} as const;

/**
 * Weekly flat-rate caps per user per pool (6-decimal XESS)
 * Applies to flat layer only - leaderboard payouts are uncapped
 */
export const FLAT_CAPS = {
  EMBED: 2_000_000_000n,   // 2,000 XESS
  XESSEX: 5_000_000_000n,  // 5,000 XESS
} as const;

/**
 * Pool budget split in basis points (10000 = 100%)
 */
export const POOL_SPLIT_BPS = {
  XESSEX: 6900n, // 69%
  EMBED: 3100n,  // 31%
} as const;
