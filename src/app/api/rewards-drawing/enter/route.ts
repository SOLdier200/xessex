/**
 * Enter Rewards Drawing with Special Credits
 *
 * POST /api/rewards-drawing/enter
 *
 * Body: { quantity: string } - number of entries
 *
 * Spends Special Credits to enter the weekly drawing.
 * 1 Special Credit = 1 entry
 *
 * Note: Special Credits are NOT purchasable and have NO cash value.
 * Credits are earned in-app based on eligibility.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { raffleWeekInfo } from "@/lib/raffleWeekPT";
import { ensureWeekRaffles } from "@/lib/rafflesEnsure";
import { DRAWING_TICKET_MICRO } from "@/lib/rewardsConstants";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = await getAccessContext();
  if (!ctx.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const userId = ctx.user.id;

  const body = await req.json().catch(() => ({}));
  let qty: bigint;
  try {
    qty = BigInt(body?.quantity ?? 0);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_quantity" }, { status: 400 });
  }

  if (qty <= 0n) {
    return NextResponse.json({ ok: false, error: "quantity_must_be_positive" }, { status: 400 });
  }

  const { weekKey, opensAt, closesAt } = raffleWeekInfo(new Date());
  await ensureWeekRaffles({ weekKey, opensAt, closesAt });

  const raffle = await db.raffle.findUnique({
    where: { weekKey_type: { weekKey, type: "CREDITS" } },
  });

  if (!raffle || raffle.status !== "OPEN") {
    return NextResponse.json({ ok: false, error: "drawing_not_open" }, { status: 400 });
  }

  const costMicro = qty * DRAWING_TICKET_MICRO;

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
          reason: `Rewards drawing entry (${qty.toString()} entr${qty === 1n ? "y" : "ies"})`,
          refType: "DRAWING_ENTRY",
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
