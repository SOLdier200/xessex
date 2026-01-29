import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";
import { getUnlockCostForNext, getUnlockLadderInfo, UNLOCK_PRICES } from "@/lib/unlockPricing";

export const runtime = "nodejs";

/**
 * GET /api/videos/unlocks/summary
 *
 * Returns user's unlock stats:
 * - unlockedCount: number of videos unlocked
 * - nextCost: cost for the next unlock
 * - creditBalance: current special credit balance
 * - ladderInfo: info about the pricing ladder
 */
export async function GET() {
  const ctx = await getAccessContext();

  if (!ctx.isAuthed || !ctx.user) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  const [account, unlockedCount] = await Promise.all([
    db.specialCreditAccount.findUnique({
      where: { userId: ctx.user.id },
      select: { balanceMicro: true },
    }),
    db.videoUnlock.count({ where: { userId: ctx.user.id } }),
  ]);

  const creditBalance = Number((account?.balanceMicro ?? 0n) / CREDIT_MICRO);
  const nextCost = getUnlockCostForNext(unlockedCount);
  const ladderInfo = getUnlockLadderInfo(unlockedCount);

  return NextResponse.json({
    ok: true,
    unlockedCount,
    nextCost,
    creditBalance,
    ladderInfo,
    priceLadder: UNLOCK_PRICES,
  });
}
