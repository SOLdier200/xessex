/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 *
 * Wallet-native access control system.
 * - Wallet = Account (no email/password login)
 * - No subscriptions or tiers
 * - All authenticated users have equal permissions
 * - Video unlocks via Special Credits
 */

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";

// Env-based admin allowlist (comma-separated wallet addresses)
const ADMIN_WALLETS = new Set(
  (process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean)
);

/**
 * Check if a ban is currently active
 * Returns true if user is banned (temp ban not expired, or perm banned)
 */
function isBanActive(
  status: string | null | undefined,
  until: Date | null | undefined
): boolean {
  if (!status) return false;
  if (status === "ALLOWED" || status === "UNBANNED") return false;
  if (status === "PERM_BANNED") return true;
  if (status === "TEMP_BANNED") {
    // Check if temp ban has expired
    if (!until) return false; // No expiry = not banned
    return until.getTime() > Date.now();
  }
  // WARNED status doesn't block actions
  return false;
}

export async function getAccessContext() {
  const user = await getCurrentUser();

  // Check user role from database OR env allowlist
  const hasAdminRole = user?.role === "ADMIN" || user?.role === "MOD";
  const walletInAllowlist = !!(user?.walletAddress && ADMIN_WALLETS.has(user.walletAddress));
  const isAdminOrMod = hasAdminRole || walletInAllowlist;

  // Wallet status - walletAddress is the primary auth wallet
  const hasWallet = !!user?.walletAddress;

  // Credit balance (for display and unlocking)
  const creditBalanceMicro = user?.specialCreditAccount?.balanceMicro ?? 0n;
  const creditBalance = Number(creditBalanceMicro / CREDIT_MICRO);

  // Check ban statuses (admins/mods bypass bans)
  const isCommentBanned = !isAdminOrMod && isBanActive(user?.commentBanStatus, user?.commentBanUntil);
  const isVoteBanned = !isAdminOrMod && isBanActive(user?.voteBanStatus, user?.voteBanUntil);
  const isRatingBanned = !isAdminOrMod && isBanActive(user?.ratingBanStatus, user?.ratingBanUntil);

  return {
    user,
    isAuthed: !!user,
    isAdminOrMod,

    // Wallet status
    hasWallet,
    walletAddress: user?.walletAddress ?? null,

    // Credit balance
    creditBalance,
    creditBalanceMicro,

    // Permissions - respects ban status
    // Admins/mods always have access, regular users checked against bans
    canComment: isAdminOrMod || (!!user && !isCommentBanned),
    canRateStars: isAdminOrMod || (!!user && !isRatingBanned),
    canVoteComments: isAdminOrMod || (!!user && !isVoteBanned),

    // Ban info for UI feedback
    isCommentBanned,
    isVoteBanned,
    isRatingBanned,
  };
}

/**
 * Check if user can access a specific video.
 * Returns true if:
 * - Video is free (unlockCost = 0)
 * - User is admin/mod
 * - User has unlocked the video
 */
export async function canAccessVideo(
  userId: string | null,
  videoId: string
): Promise<{ canAccess: boolean; unlockCost: number; isUnlocked: boolean }> {
  // Get video unlock cost
  const video = await db.video.findUnique({
    where: { id: videoId },
    select: { unlockCost: true },
  });

  if (!video) {
    return { canAccess: false, unlockCost: 0, isUnlocked: false };
  }

  // Free videos are accessible to everyone
  if (video.unlockCost === 0) {
    return { canAccess: true, unlockCost: 0, isUnlocked: true };
  }

  // Anonymous users cannot access paid videos
  if (!userId) {
    return { canAccess: false, unlockCost: video.unlockCost, isUnlocked: false };
  }

  // Check for admin/mod status
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, walletAddress: true },
  });

  if (user) {
    const hasAdminRole = user.role === "ADMIN" || user.role === "MOD";
    const walletInAllowlist = !!(user.walletAddress && ADMIN_WALLETS.has(user.walletAddress));

    if (hasAdminRole || walletInAllowlist) {
      return { canAccess: true, unlockCost: video.unlockCost, isUnlocked: true };
    }
  }

  // Check if user has unlocked this video
  const unlock = await db.videoUnlock.findUnique({
    where: {
      userId_videoId: { userId, videoId },
    },
  });

  if (unlock) {
    return { canAccess: true, unlockCost: video.unlockCost, isUnlocked: true };
  }

  return { canAccess: false, unlockCost: video.unlockCost, isUnlocked: false };
}
