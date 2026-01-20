/**
 * Claim Credits Raffle Prize
 *
 * POST /api/raffles/claim/credits
 *
 * Body: { winnerId: string }
 *
 * Claims a pending credits raffle win and credits the user's account.
 * Expires removes claim (cannot claim after expiry).
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
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const now = new Date();

  const w = await db.raffleWinner.findUnique({
    where: { id: winnerId },
    include: { raffle: true },
  });

  if (!w || w.userId !== userId) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (w.raffle.type !== "CREDITS") {
    return NextResponse.json({ ok: false, error: "wrong_type" }, { status: 400 });
  }

  if (w.status !== "PENDING") {
    return NextResponse.json({ ok: false, error: "not_pending" }, { status: 400 });
  }

  if (now > w.expiresAt) {
    return NextResponse.json({ ok: false, error: "expired" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    await tx.raffleWinner.update({
      where: { id: w.id },
      data: { status: "CLAIMED", claimedAt: now },
    });

    await tx.specialCreditAccount.upsert({
      where: { userId },
      create: { userId, balanceMicro: w.prizeCreditsMicro, carryMicro: 0n },
      update: { balanceMicro: { increment: w.prizeCreditsMicro } },
    });

    await tx.specialCreditLedger.create({
      data: {
        userId,
        weekKey: w.raffle.weekKey,
        amountMicro: w.prizeCreditsMicro,
        reason: `Raffle prize (place ${w.place})`,
        refType: "RAFFLE_PRIZE_CREDITS",
        refId: w.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
