/**
 * Progressive unlock pricing ladder.
 *
 * Cost increases with each video unlocked:
 * - First video: 10 credits
 * - Increases by 10 each unlock
 * - After 50 unlocks: capped at 500 credits forever
 */

export const UNLOCK_PRICES: number[] = [
  10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
  110, 120, 130, 140, 150, 160, 170, 180, 190, 200,
  210, 220, 230, 240, 250, 260, 270, 280, 290, 300,
  310, 320, 330, 340, 350, 360, 370, 380, 390, 400,
  410, 420, 430, 440, 450, 460, 470, 480, 490, 500,
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
