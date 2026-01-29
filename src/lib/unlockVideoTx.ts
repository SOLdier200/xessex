/**
 * Atomic video unlock transaction.
 * Uses existing SpecialCreditAccount (microcredits) system.
 * Cost determined by progressive pricing ladder based on user's unlock count.
 *
 * IDEMPOTENT: Returns success (alreadyUnlocked: true) if video was already unlocked.
 * Accepts either Prisma Video.id (cuid) OR Video.slug/viewkey.
 */

import { db } from "@/lib/prisma";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";
import { getUnlockCostForNext } from "@/lib/unlockPricing";

type UnlockResult =
  | {
      ok: true;
      newCredits: number;
      cost: number;
      unlockedCount: number;
      alreadyUnlocked: boolean;
      nextCost: number;
      videoId: string;    // Prisma video id
      videoSlug: string;  // canonical slug
    }
  | { ok: false; error: "not_found" | "insufficient_credits" | "no_credit_account" };

/**
 * Get ISO week key (Monday-based) for ledger entry
 */
function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().split("T")[0];
}

/**
 * Unlock a video for a user:
 * - checks already unlocked (returns success with alreadyUnlocked: true)
 * - checks sufficient credits (using SpecialCreditAccount.balanceMicro)
 * - decrements credits
 * - inserts VideoUnlock
 * - inserts SpecialCreditLedger
 *
 * All in ONE transaction, safe against double-click.
 * IDEMPOTENT: calling twice on same video returns success without charging.
 *
 * @param videoKey - Either Video.id (cuid) OR Video.slug/viewkey
 */
export async function unlockVideoTx(params: {
  userId: string;
  videoKey: string;
}): Promise<UnlockResult> {
  const { userId, videoKey } = params;

  return await db.$transaction(async (tx) => {
    // Find video by id OR slug
    const video = await tx.video.findFirst({
      where: {
        OR: [{ id: videoKey }, { slug: videoKey }],
      },
      select: { id: true, title: true, slug: true, unlockCost: true },
    });

    if (!video) return { ok: false as const, error: "not_found" };

    // Get account early (needed for idempotent response)
    const account = await tx.specialCreditAccount.findUnique({
      where: { userId },
      select: { balanceMicro: true },
    });

    if (!account) {
      return { ok: false as const, error: "no_credit_account" };
    }

    // Check if video is free (unlockCost = 0 means free content)
    if (video.unlockCost === 0) {
      const existingCount = await tx.videoUnlock.count({ where: { userId } });
      const nextCost = getUnlockCostForNext(existingCount);
      return {
        ok: true as const,
        newCredits: Number(account.balanceMicro / CREDIT_MICRO),
        cost: 0,
        unlockedCount: existingCount,
        alreadyUnlocked: false,
        nextCost,
        videoId: video.id,
        videoSlug: video.slug,
      };
    }

    // IDEMPOTENT: If already unlocked, return success with no charge
    const existing = await tx.videoUnlock.findUnique({
      where: { userId_videoId: { userId, videoId: video.id } },
      select: { id: true },
    });

    if (existing) {
      const existingCount = await tx.videoUnlock.count({ where: { userId } });
      const nextCost = getUnlockCostForNext(existingCount);
      return {
        ok: true as const,
        alreadyUnlocked: true,
        cost: 0,
        newCredits: Number(account.balanceMicro / CREDIT_MICRO),
        unlockedCount: existingCount,
        nextCost,
        videoId: video.id,
        videoSlug: video.slug,
      };
    }

    // Count user's existing unlocks to determine ladder position
    const unlockedCount = await tx.videoUnlock.count({
      where: { userId },
    });

    // Get cost from progressive pricing ladder
    const cost = getUnlockCostForNext(unlockedCount);
    const costMicro = BigInt(cost) * CREDIT_MICRO;

    if (account.balanceMicro < costMicro) {
      return { ok: false as const, error: "insufficient_credits" };
    }

    // Debit credits atomically
    await tx.specialCreditAccount.update({
      where: { userId },
      data: {
        balanceMicro: { decrement: costMicro },
      },
    });

    // Create unlock record (unique constraint prevents race-condition duplicates)
    await tx.videoUnlock.create({
      data: { userId, videoId: video.id, cost },
    });

    // Ledger entry for audit
    const weekKey = getWeekKey(new Date());
    await tx.specialCreditLedger.create({
      data: {
        userId,
        weekKey,
        amountMicro: -costMicro,
        reason: `Unlocked: ${video.title || video.id}`,
        refType: "VIDEO_UNLOCK",
        refId: `${userId}_${video.id}`,
      },
    });

    const accountAfter = await tx.specialCreditAccount.findUnique({
      where: { userId },
      select: { balanceMicro: true },
    });

    const newUnlockedCount = unlockedCount + 1;
    const nextCost = getUnlockCostForNext(newUnlockedCount);

    return {
      ok: true as const,
      alreadyUnlocked: false,
      newCredits: Number((accountAfter?.balanceMicro ?? 0n) / CREDIT_MICRO),
      cost,
      unlockedCount: newUnlockedCount,
      nextCost,
      videoId: video.id,
      videoSlug: video.slug,
    };
  });
}
