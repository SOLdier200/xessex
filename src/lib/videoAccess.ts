/**
 * Video access helpers for the unlock system.
 * Works with existing SpecialCreditAccount (microcredits).
 */

import { db } from "@/lib/prisma";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";

export type VideoAccessResult =
  | { ok: true; unlocked: true; reason: "free" | "unlocked" | "staff"; unlockCost: number }
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
    select: { id: true, unlockCost: true, isActive: true },
  });

  if (!video) return { ok: false, error: "not_found" };

  const unlockCost = video.unlockCost ?? 0;

  // Free video
  if (unlockCost <= 0) {
    return { ok: true, unlocked: true, reason: "free", unlockCost };
  }

  // Staff override
  if (isAdminOrMod) {
    return { ok: true, unlocked: true, reason: "staff", unlockCost };
  }

  // Locked video requires auth
  if (!userId) {
    return { ok: false, error: "not_authenticated" };
  }

  const unlock = await db.videoUnlock.findUnique({
    where: { userId_videoId: { userId, videoId } },
    select: { id: true },
  });

  if (unlock) {
    return { ok: true, unlocked: true, reason: "unlocked", unlockCost };
  }

  return { ok: true, unlocked: false, reason: "locked", unlockCost, creditBalance };
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
    select: { id: true, unlockCost: true },
  });

  if (!video) return { ok: false, error: "not_found" };

  const unlockCost = video.unlockCost ?? 0;

  // Free videos
  if (unlockCost <= 0) {
    return { ok: true, unlocked: true, reason: "free", unlockCost };
  }

  // Staff override
  if (userRole === "ADMIN" || userRole === "MOD") {
    return { ok: true, unlocked: true, reason: "staff", unlockCost };
  }

  // Must be logged in for locked videos
  if (!userId) {
    return { ok: false, error: "not_authenticated" };
  }

  const [unlock, creditAccount] = await Promise.all([
    db.videoUnlock.findUnique({
      where: { userId_videoId: { userId, videoId } },
      select: { id: true },
    }),
    db.specialCreditAccount.findUnique({
      where: { userId },
      select: { balanceMicro: true },
    }),
  ]);

  if (unlock) {
    return { ok: true, unlocked: true, reason: "unlocked", unlockCost };
  }

  const creditBalance = Number((creditAccount?.balanceMicro ?? 0n) / CREDIT_MICRO);
  return { ok: true, unlocked: false, reason: "locked", unlockCost, creditBalance };
}
