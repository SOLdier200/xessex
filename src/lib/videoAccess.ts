/**
 * Video access helpers for the unlock system.
 * Works with existing SpecialCreditAccount (microcredits).
 * Uses progressive pricing ladder for unlock costs.
 */

import { db } from "@/lib/prisma";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";
import { getUnlockCostForNext } from "@/lib/unlockPricing";

export type VideoAccessResult =
  | { ok: true; unlocked: true; reason: "free" | "unlocked"; unlockCost: number }
  | { ok: true; unlocked: false; reason: "locked"; unlockCost: number; creditBalance: number }
  | { ok: false; error: "not_found" | "not_authenticated" };

/**
 * Check if a user can access a video.
 * Uses data from getAccessContext() to avoid extra DB calls.
 */
export async function getVideoAccessForContext(params: {
  videoId: string;
  userId: string | null;
  isAdminOrMod: boolean;
  creditBalance: number; // whole credits from getAccessContext()
}): Promise<VideoAccessResult> {
  const { videoId, userId, isAdminOrMod, creditBalance } = params;

  const video = await db.video.findUnique({
    where: { id: videoId },
    select: { id: true, unlockCost: true, isActive: true, kind: true },
  });

  if (!video) return { ok: false, error: "not_found" };

  return getVideoAccessWithData({
    videoId,
    userId,
    isAdminOrMod,
    creditBalance,
    videoKind: video.kind,
    videoUnlockCost: video.unlockCost ?? 0,
  });
}

/**
 * Optimized version that accepts video data directly to avoid redundant DB query.
 * Use when you already have the video data from a previous query.
 */
export async function getVideoAccessWithData(params: {
  videoId: string;
  userId: string | null;
  isAdminOrMod: boolean;
  creditBalance: number;
  videoKind: string;
  videoUnlockCost: number;
}): Promise<VideoAccessResult> {
  const { videoId, userId, isAdminOrMod, creditBalance, videoKind, videoUnlockCost } = params;

  const unlockCost = videoUnlockCost ?? 0;

  // XESSEX videos are always free (no unlock required)
  if (videoKind === "XESSEX") {
    return { ok: true, unlocked: true, reason: "free", unlockCost: 0 };
  }

  // Free video
  if (unlockCost <= 0) {
    return { ok: true, unlocked: true, reason: "free", unlockCost };
  }

  // Everyone must pay — no staff bypass
  // Locked video requires auth
  if (!userId) {
    return { ok: false, error: "not_authenticated" };
  }

  const [unlock, unlockedCount] = await Promise.all([
    db.videoUnlock.findUnique({
      where: { userId_videoId: { userId, videoId } },
      select: { id: true },
    }),
    db.videoUnlock.count({ where: { userId } }),
  ]);

  if (unlock) {
    return { ok: true, unlocked: true, reason: "unlocked", unlockCost };
  }

  // Use progressive pricing ladder for the next unlock cost
  const nextCost = getUnlockCostForNext(unlockedCount);
  return { ok: true, unlocked: false, reason: "locked", unlockCost: nextCost, creditBalance };
}

/**
 * Standalone video access check (fetches user data directly).
 * Use when getAccessContext() hasn't been called.
 */
export async function getVideoAccess(params: {
  userId: string | null;
  userRole?: "USER" | "MOD" | "ADMIN";
  videoId: string;
}): Promise<VideoAccessResult> {
  const { userId, userRole, videoId } = params;

  const video = await db.video.findUnique({
    where: { id: videoId },
    select: { id: true, unlockCost: true, kind: true },
  });

  if (!video) return { ok: false, error: "not_found" };

  const unlockCost = video.unlockCost ?? 0;

  // XESSEX videos are always free (no unlock required)
  if (video.kind === "XESSEX") {
    return { ok: true, unlocked: true, reason: "free", unlockCost: 0 };
  }

  // Free videos
  if (unlockCost <= 0) {
    return { ok: true, unlocked: true, reason: "free", unlockCost };
  }

  // Everyone must pay — no staff bypass
  // Must be logged in for locked videos
  if (!userId) {
    return { ok: false, error: "not_authenticated" };
  }

  const [unlock, creditAccount, unlockedCount] = await Promise.all([
    db.videoUnlock.findUnique({
      where: { userId_videoId: { userId, videoId } },
      select: { id: true },
    }),
    db.specialCreditAccount.findUnique({
      where: { userId },
      select: { balanceMicro: true },
    }),
    db.videoUnlock.count({ where: { userId } }),
  ]);

  if (unlock) {
    return { ok: true, unlocked: true, reason: "unlocked", unlockCost };
  }

  const creditBalance = Number((creditAccount?.balanceMicro ?? 0n) / CREDIT_MICRO);
  // Use progressive pricing ladder for the next unlock cost
  const nextCost = getUnlockCostForNext(unlockedCount);
  return { ok: true, unlocked: false, reason: "locked", unlockCost: nextCost, creditBalance };
}
