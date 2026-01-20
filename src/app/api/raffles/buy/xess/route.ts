/**
 * Buy XESS Raffle Tickets
 *
 * POST /api/raffles/buy/xess
 *
 * Body: { txSig: string }
 *
 * Verifies on-chain XESS transfer to treasury.
 * Transaction must transfer exact multiple of 100 XESS (ticket price).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { raffleWeekInfo } from "@/lib/raffleWeekPT";
import { ensureWeekRaffles } from "@/lib/rafflesEnsure";
import { verifyXessTicketPurchaseTx } from "@/lib/verifyXessTicketPurchase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = await getAccessContext();
  if (!ctx.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const txSig = String(body?.txSig || "").trim();
  if (!txSig) {
    return NextResponse.json({ ok: false, error: "missing_txSig" }, { status: 400 });
  }

  // Load user + linked wallet
  const user = await db.user.findUnique({
    where: { id: ctx.user.id },
    select: { id: true, solWallet: true },
  });

  if (!user?.solWallet) {
    return NextResponse.json({ ok: false, error: "no_linked_wallet" }, { status: 400 });
  }

  const { weekKey, opensAt, closesAt } = raffleWeekInfo(new Date());
  await ensureWeekRaffles({ weekKey, opensAt, closesAt });

  const raffle = await db.raffle.findUnique({
    where: { weekKey_type: { weekKey, type: "XESS" } },
  });

  if (!raffle || raffle.status !== "OPEN") {
    return NextResponse.json({ ok: false, error: "raffle_not_open" }, { status: 400 });
  }

  // Verify payment tx -> derive quantity
  let verified;
  try {
    verified = await verifyXessTicketPurchaseTx({
      txSig,
      userWallet: user.solWallet,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  // Prevent replay + mint tickets + increment pools
  try {
    await db.$transaction(async (tx) => {
      // txSig uniqueness enforced by RafflePurchase.txSig @unique
      await tx.rafflePurchase.create({
        data: {
          raffleId: raffle.id,
          userId: user.id,
          type: "XESS",
          txSig,
          quantity: verified.quantity,
          amountAtomic: verified.amountAtomic,
        },
      });

      await tx.raffleTicket.create({
        data: {
          raffleId: raffle.id,
          userId: user.id,
          quantity: verified.quantity,
        },
      });

      await tx.raffle.update({
        where: { id: raffle.id },
        data: {
          userPoolXessAtomic: { increment: verified.amountAtomic },
          totalTickets: { increment: verified.quantity },
        },
      });
    });
  } catch (e: unknown) {
    // If txSig already used
    const msg = String(e instanceof Error ? e.message : e);
    if (msg.includes("Unique constraint failed") || msg.includes("Unique constraint")) {
      return NextResponse.json({ ok: false, error: "txSig_already_used" }, { status: 400 });
    }
    throw e;
  }

  return NextResponse.json({
    ok: true,
    weekKey,
    quantity: verified.quantity.toString(),
    amountAtomic: verified.amountAtomic.toString(),
  });
}
