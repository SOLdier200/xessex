/**
 * Comment Scoring Formula (exact weights from spec):
 * score = (+5 * memberLikes) + (+35 * modLikes) + (-1 * memberDislikes) + (-20 * modDislikes)
 */
export function computeCommentScore(opts: {
  memberLikes: number;
  memberDislikes: number;
  modLikes: number;
  modDislikes: number;
}): number {
  const { memberLikes, memberDislikes, modLikes, modDislikes } = opts;
  return (
    5 * memberLikes +
    35 * modLikes +
    -1 * memberDislikes +
    -20 * modDislikes
  );
}

/**
 * Clamp an integer to a range
 */
export function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/**
 * Truncate wallet address for display
 */
export function truncWallet(w: string): string {
  if (w.length <= 10) return w;
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}
