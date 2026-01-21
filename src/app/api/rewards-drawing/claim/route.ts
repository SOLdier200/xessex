/**
 * Claim Rewards Drawing Prize
 *
 * POST /api/rewards-drawing/claim
 *
 * Body: { winnerId: string }
 *
 * Claims a pending drawing win and credits the user's Special Credits balance.
 * Prizes are Special Credits only (no XESS or cash value).
 * Cannot claim after expiry - unclaimed prizes roll into next week's pool.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = await getAccessContext();
  if (!ctx.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const userId = ctx.user.id;

  const body = await req.json().catch(() => ({}));
  const winnerId = String(body?.winnerId || "");
  if (!winnerId) {
    return NextResponse.json({ ok: false, error: "missing_winner_id" }, { status: 400 });
  }

  const now = new Date();

  const w = await db.raffleWinner.findUnique({
    where: { id: winnerId },
    include: { raffle: true },
  });

  if (!w || w.userId !== userId) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // Only allow credits drawing claims
  if (w.raffle.type !== "CREDITS") {
    return NextResponse.json({ ok: false, error: "invalid_drawing_type" }, { status: 400 });
  }

  if (w.status !== "PENDING") {
    return NextResponse.json({ ok: false, error: "already_claimed_or_expired" }, { status: 400 });
  }

  if (now > w.expiresAt) {
    return NextResponse.json({ ok: false, error: "prize_expired" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    // Mark as claimed
    await tx.raffleWinner.update({
      where: { id: w.id },
      data: { status: "CLAIMED", claimedAt: now },
    });

    // Credit the user's Special Credits balance
    await tx.specialCreditAccount.upsert({
      where: { userId },
      create: { userId, balanceMicro: w.prizeCreditsMicro, carryMicro: 0n },
      update: { balanceMicro: { increment: w.prizeCreditsMicro } },
    });

    // Record in ledger
    await tx.specialCreditLedger.create({
      data: {
        userId,
        weekKey: w.raffle.weekKey,
        amountMicro: w.prizeCreditsMicro,
        reason: `Drawing prize (${w.place === 1 ? "1st" : w.place === 2 ? "2nd" : "3rd"} place)`,
        refType: "DRAWING_PRIZE",
        refId: w.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
