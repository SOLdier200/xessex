/**
 * Progressive unlock pricing ladder.
 *
 * Cost increases with each video unlocked:
 * - First video: 10 credits
 * - Gradual increase to 500 credits
 * - After 26 unlocks: capped at 500 credits forever
 */

export const UNLOCK_PRICES: number[] = [
  10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
  125, 150, 175, 200, 225, 250, 275, 300, 325, 350,
  375, 400, 425, 450, 475, 500,
];

/**
 * Get the cost for the user's NEXT unlock based on how many they've already unlocked.
 *
 * @param unlockedCount - Number of videos user has already unlocked
 * @returns Credits required for next unlock
 */
export function getUnlockCostForNext(unlockedCount: number): number {
  if (unlockedCount < 0) return UNLOCK_PRICES[0];
  if (unlockedCount < UNLOCK_PRICES.length) return UNLOCK_PRICES[unlockedCount];
  return 500; // Capped at 500 after all ladder steps
}

/**
 * Get remaining ladder info for UI display
 */
export function getUnlockLadderInfo(unlockedCount: number): {
  nextCost: number;
  stepIndex: number;
  isMaxed: boolean;
  totalSteps: number;
} {
  const nextCost = getUnlockCostForNext(unlockedCount);
  const isMaxed = unlockedCount >= UNLOCK_PRICES.length;

  return {
    nextCost,
    stepIndex: Math.min(unlockedCount, UNLOCK_PRICES.length - 1),
    isMaxed,
    totalSteps: UNLOCK_PRICES.length,
  };
}
