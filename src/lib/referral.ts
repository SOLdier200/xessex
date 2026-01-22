/**
 * Referral code generation and utilities
 */

/**
 * Generate a short, URL-safe, readable referral code
 * Format: XESS-XXXXXX (6 alphanumeric characters)
 */
export function generateReferralCode(): string {
  // Excluding confusing characters: 0, O, 1, I, L
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "XESS-";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/**
 * Get ISO week key from a date
 * Format: "YYYY-WXX" (e.g., "2024-W03")
 */
export function getWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

/**
 * Get the start date (Monday 00:00 UTC) of a given ISO week
 */
export function getWeekStart(weekKey: string): Date {
  const [yearStr, weekStr] = weekKey.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);

  // Find January 4th of that year (always in week 1)
  const jan4 = new Date(Date.UTC(year, 0, 4));
  // Get day of week (0=Sun, 1=Mon, ..., 6=Sat)
  const jan4Day = jan4.getUTCDay() || 7; // Convert Sunday from 0 to 7

  // Find the Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

  // Add (week - 1) * 7 days to get to the desired week's Monday
  const targetMonday = new Date(week1Monday);
  targetMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  targetMonday.setUTCHours(0, 0, 0, 0);

  return targetMonday;
}

/**
 * Get the end date (Sunday 23:59:59.999 UTC) of a given ISO week
 */
export function getWeekEnd(weekKey: string): Date {
  const start = getWeekStart(weekKey);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  end.setUTCMilliseconds(-1); // Sunday 23:59:59.999
  return end;
}

/**
 * Get the previous week's key from a given week key
 */
export function getPreviousWeekKey(weekKey: string): string {
  const start = getWeekStart(weekKey);
  start.setUTCDate(start.getUTCDate() - 7);
  return getWeekKey(start);
}

/**
 * Ladder distribution for top 50 likes
 * Based on the plan:
 * - Rank 1: 10%
 * - Rank 2: 6%
 * - Rank 3: 4%
 * - Rank 4-10: 2% each (14% total)
 * - Rank 11-50: remaining 66% split evenly (~1.65% each)
 */
export function getLikesLadderShare(rank: number): number {
  if (rank < 1 || rank > 50) return 0;

  if (rank === 1) return 0.10;
  if (rank === 2) return 0.06;
  if (rank === 3) return 0.04;
  if (rank >= 4 && rank <= 10) return 0.02;
  // Ranks 11-50: 66% split among 40 users
  return 0.66 / 40;
}

/**
 * Calculate rewards for top 50 using ladder distribution
 * @param weeklyBudget Total XESS budget for likes this week (in smallest units)
 * @param rankings Array of { userId, likes } sorted by likes desc
 * @returns Array of { userId, amount } rewards
 */
export function calculateLikesRewards(
  weeklyBudget: bigint,
  rankings: { userId: string; likes: number }[]
): { userId: string; amount: bigint }[] {
  const rewards: { userId: string; amount: bigint }[] = [];

  for (let i = 0; i < Math.min(rankings.length, 50); i++) {
    const share = getLikesLadderShare(i + 1);
    const amount = BigInt(Math.floor(Number(weeklyBudget) * share));
    if (amount > 0) {
      rewards.push({ userId: rankings[i].userId, amount });
    }
  }

  return rewards;
}

/**
 * Referral reward structure (from weekly referral budget)
 * L1 (direct referral): 50%
 * L2 (referral's referral): 30%
 * L3 (L2's referral): 20%
 */
export const REFERRAL_SHARES = {
  L1: 0.50,
  L2: 0.30,
  L3: 0.20,
} as const;

/**
 * Calculate referral stream rewards
 * @param weeklyBudget Total XESS budget for referrals this week
 * @param referralCount Number of new referrals this week
 * @param perReferralAmount Amount per referral (budget / referralCount)
 */
export function calculateReferralReward(
  tier: "L1" | "L2" | "L3",
  perReferralAmount: bigint
): bigint {
  return BigInt(Math.floor(Number(perReferralAmount) * REFERRAL_SHARES[tier]));
}
