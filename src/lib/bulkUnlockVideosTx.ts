/**
 * Bulk unlock transaction.
 * Unlocks up to 5 videos in a single transaction.
 * Uses progressive pricing ladder - each unlock costs more.
 * IDEMPOTENT: Already unlocked videos return success with no charge.
 * Stops when credits run out (partial success possible).
 *
 * Accepts either Prisma Video.id (cuid) OR Video.slug/viewkey for each video.
 */

import { db } from "@/lib/prisma";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";
import { getUnlockCostForNext } from "@/lib/unlockPricing";

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().split("T")[0];
}

type BulkItem =
  | { videoKey: string; videoId: string; videoSlug: string; ok: true; alreadyUnlocked: boolean; cost: number }
  | { videoKey: string; ok: false; error: "not_found" | "insufficient_credits" };

type BulkUnlockResult =
  | { ok: true; items: BulkItem[]; newCredits: number; totalCost: number; unlockedCount: number }
  | { ok: false; error: "no_credit_account" };

/**
 * @param videoKeys - Array of Video.id (cuid) OR Video.slug/viewkey
 */
export async function bulkUnlockVideosTx(params: {
  userId: string;
  videoKeys: string[];
}): Promise<BulkUnlockResult> {
  const { userId } = params;

  // Keep order, unique, cap at 5
  const unique = Array.from(new Set(params.videoKeys)).slice(0, 5);

  return await db.$transaction(async (tx) => {
    const account = await tx.specialCreditAccount.findUnique({
      where: { userId },
      select: { balanceMicro: true },
    });

    if (!account) {
      return { ok: false as const, error: "no_credit_account" };
    }

    // Load videos by id OR slug
    const videos = await tx.video.findMany({
      where: {
        OR: [{ id: { in: unique } }, { slug: { in: unique } }],
      },
      select: { id: true, title: true, slug: true },
    });

    // Map by both id and slug for lookup
    const byId = new Map(videos.map((v) => [v.id, v]));
    const bySlug = new Map(videos.map((v) => [v.slug, v]));

    // Get all video IDs that were found
    const foundVideoIds = videos.map((v) => v.id);

    // Already unlocked for these targets
    const existing = await tx.videoUnlock.findMany({
      where: { userId, videoId: { in: foundVideoIds } },
      select: { videoId: true },
    });
    const unlockedSet = new Set(existing.map((x) => x.videoId));

    // Ladder position starts from total unlocked (not just these)
    let unlockedCount = await tx.videoUnlock.count({ where: { userId } });

    let balanceMicro = account.balanceMicro;
    const weekKey = getWeekKey(new Date());
    const items: BulkItem[] = [];
    let totalCost = 0;

    for (const videoKey of unique) {
      // Lookup by id first, then by slug
      const v = byId.get(videoKey) ?? bySlug.get(videoKey);
      if (!v) {
        items.push({ videoKey, ok: false, error: "not_found" });
        continue;
      }

      if (unlockedSet.has(v.id)) {
        items.push({ videoKey, videoId: v.id, videoSlug: v.slug, ok: true, alreadyUnlocked: true, cost: 0 });
        continue;
      }

      const cost = getUnlockCostForNext(unlockedCount);
      const costMicro = BigInt(cost) * CREDIT_MICRO;

      if (balanceMicro < costMicro) {
        items.push({ videoKey, ok: false, error: "insufficient_credits" });
        break; // Stop once funds run out
      }

      balanceMicro -= costMicro;

      // Unlock record
      await tx.videoUnlock.create({
        data: { userId, videoId: v.id, cost },
      });

      // Ledger record
      await tx.specialCreditLedger.create({
        data: {
          userId,
          weekKey,
          amountMicro: -costMicro,
          reason: `Unlocked: ${v.title || v.id}`,
          refType: "VIDEO_UNLOCK",
          refId: `${userId}_${v.id}`,
        },
      });

      items.push({ videoKey, videoId: v.id, videoSlug: v.slug, ok: true, alreadyUnlocked: false, cost });
      totalCost += cost;
      unlockedCount += 1;
    }

    // Persist net spend at end (fewer writes)
    const spentMicro = account.balanceMicro - balanceMicro;
    if (spentMicro > 0n) {
      await tx.specialCreditAccount.update({
        where: { userId },
        data: { balanceMicro: { decrement: spentMicro } },
      });
    }

    return {
      ok: true as const,
      items,
      totalCost,
      newCredits: Number(balanceMicro / CREDIT_MICRO),
      unlockedCount,
    };
  });
}
