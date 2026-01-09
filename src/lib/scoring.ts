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
 * Truncate wallet address or email for display
 * Returns "Anonymous" if both are empty/null
 */
export function truncWallet(wallet: string | null | undefined, email?: string | null): string {
  if (wallet && wallet.length > 0) {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
  }
  if (email && email.length > 0) {
    const atIndex = email.indexOf("@");
    if (atIndex > 0) {
      const local = email.slice(0, atIndex);
      const domain = email.slice(atIndex);
      if (local.length > 4) {
        return `${local.slice(0, 2)}***${domain}`;
      }
      return `${local[0]}***${domain}`;
    }
    return email.slice(0, 4) + "***";
  }
  return "Anonymous";
}
