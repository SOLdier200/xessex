/**
 * Atomic video unlock transaction.
 * Uses existing SpecialCreditAccount (microcredits) system.
 */

import { db } from "@/lib/prisma";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";

type UnlockResult =
  | { ok: true; newCredits: number; cost: number }
  | { ok: false; error: "not_found" | "already_unlocked" | "insufficient_credits" | "no_credit_account" };

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
 * - checks already unlocked
 * - checks sufficient credits (using SpecialCreditAccount.balanceMicro)
 * - decrements credits
 * - inserts VideoUnlock
 * - inserts SpecialCreditLedger
 *
 * All in ONE transaction, safe against double-click.
 */
export async function unlockVideoTx(params: {
  userId: string;
  videoId: string;
}): Promise<UnlockResult> {
  const { userId, videoId } = params;

  return await db.$transaction(async (tx) => {
    const video = await tx.video.findUnique({
      where: { id: videoId },
      select: { id: true, title: true, unlockCost: true },
    });

    if (!video) return { ok: false as const, error: "not_found" };

    const cost = video.unlockCost ?? 0;

    if (cost <= 0) {
      // Free content: treat as already accessible
      const account = await tx.specialCreditAccount.findUnique({
        where: { userId },
        select: { balanceMicro: true },
      });
      return {
        ok: true as const,
        newCredits: Number((account?.balanceMicro ?? 0n) / CREDIT_MICRO),
        cost: 0,
      };
    }

    // Already unlocked?
    const existing = await tx.videoUnlock.findUnique({
      where: { userId_videoId: { userId, videoId } },
      select: { id: true },
    });

    if (existing) return { ok: false as const, error: "already_unlocked" };

    // Get credit account
    const account = await tx.specialCreditAccount.findUnique({
      where: { userId },
      select: { balanceMicro: true },
    });

    if (!account) {
      return { ok: false as const, error: "no_credit_account" };
    }

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
      data: { userId, videoId, cost },
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
        refId: `${userId}_${videoId}`,
      },
    });

    const accountAfter = await tx.specialCreditAccount.findUnique({
      where: { userId },
      select: { balanceMicro: true },
    });

    return {
      ok: true as const,
      newCredits: Number((accountAfter?.balanceMicro ?? 0n) / CREDIT_MICRO),
      cost,
    };
  });
}
