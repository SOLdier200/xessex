/**
 * Buy Credits Raffle Tickets
 *
 * POST /api/raffles/buy/credits
 *
 * Body: { quantity: number }
 *
 * Deducts credits from user's SpecialCreditAccount.
 * 1 credit = 1 ticket
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { raffleWeekInfo } from "@/lib/raffleWeekPT";
import { ensureWeekRaffles } from "@/lib/rafflesEnsure";
import { RAFFLE_CREDIT_TICKET_MICRO } from "@/lib/rewardsConstants";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = await getAccessContext();
  if (!ctx.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const userId = ctx.user.id;

  const body = await req.json().catch(() => ({}));
  const qty = BigInt(body?.quantity ?? 0);
  if (qty <= 0n) {
    return NextResponse.json({ ok: false, error: "bad_quantity" }, { status: 400 });
  }

  const { weekKey, opensAt, closesAt } = raffleWeekInfo(new Date());
  await ensureWeekRaffles({ weekKey, opensAt, closesAt });

  const raffle = await db.raffle.findUnique({
    where: { weekKey_type: { weekKey, type: "CREDITS" } },
  });

  if (!raffle || raffle.status !== "OPEN") {
    return NextResponse.json({ ok: false, error: "raffle_not_open" }, { status: 400 });
  }

  const costMicro = qty * RAFFLE_CREDIT_TICKET_MICRO;

  try {
    await db.$transaction(async (tx) => {
      const acct = await tx.specialCreditAccount.upsert({
        where: { userId },
        create: { userId, balanceMicro: 0n, carryMicro: 0n },
        update: {},
      });

      if (acct.balanceMicro < costMicro) {
        throw new Error("insufficient_credits");
      }

      await tx.specialCreditAccount.update({
        where: { userId },
        data: { balanceMicro: { decrement: costMicro } },
      });

      await tx.specialCreditLedger.create({
        data: {
          userId,
          weekKey,
          amountMicro: -costMicro,
          reason: `Bought ${qty.toString()} raffle ticket(s)`,
          refType: "RAFFLE_BUY_CREDITS",
          refId: `${raffle.id}:${userId}:${Date.now()}`,
        },
      });

      await tx.raffleTicket.create({
        data: { raffleId: raffle.id, userId, quantity: qty },
      });

      await tx.raffle.update({
        where: { id: raffle.id },
        data: {
          userPoolCreditsMicro: { increment: costMicro },
          totalTickets: { increment: qty },
        },
      });
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "insufficient_credits") {
      return NextResponse.json({ ok: false, error: "insufficient_credits" }, { status: 400 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
