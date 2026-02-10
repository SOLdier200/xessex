/**
 * Admin: Manual Raffle Draw
 *
 * GET  /api/admin/raffle-manual-draw?weekKey=2026-02-08
 *   → Shows raffle state for that week (or all recent if no weekKey)
 *
 * POST /api/admin/raffle-manual-draw  { weekKey: "2026-02-08" }
 *   → Manually closes + draws winners for a missed week
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { requireAdminOrMod } from "@/lib/adminActions";
import crypto from "crypto";

export const runtime = "nodejs";

// ── GET: inspect raffle state ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const admin = await requireAdminOrMod();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const weekKey = req.nextUrl.searchParams.get("weekKey");

  if (weekKey) {
    const raffle = await db.raffle.findUnique({
      where: { weekKey_type: { weekKey, type: "CREDITS" } },
      include: {
        winners: { include: { user: { select: { id: true, email: true } } } },
        _count: { select: { tickets: true } },
      },
    });

    if (!raffle) {
      return NextResponse.json({ ok: false, error: `No raffle found for weekKey=${weekKey}` }, { status: 404 });
    }

    const ticketsByUser = await db.raffleTicket.groupBy({
      by: ["userId"],
      where: { raffleId: raffle.id },
      _sum: { quantity: true },
    });

    return NextResponse.json({
      ok: true,
      raffle: {
        id: raffle.id,
        weekKey: raffle.weekKey,
        status: raffle.status,
        totalTickets: raffle.totalTickets.toString(),
        userPoolCreditsMicro: raffle.userPoolCreditsMicro.toString(),
        matchPoolCreditsMicro: raffle.matchPoolCreditsMicro.toString(),
        rolloverCreditsMicro: raffle.rolloverCreditsMicro.toString(),
        opensAt: raffle.opensAt.toISOString(),
        closesAt: raffle.closesAt.toISOString(),
        drawnAt: raffle.drawnAt?.toISOString() ?? null,
        ticketEntries: raffle._count.tickets,
        winners: raffle.winners.map((w) => ({
          id: w.id,
          userId: w.userId,
          email: w.user.email,
          place: w.place,
          prizeCreditsMicro: w.prizeCreditsMicro.toString(),
          status: w.status,
          expiresAt: w.expiresAt.toISOString(),
          claimedAt: w.claimedAt?.toISOString() ?? null,
        })),
        entrants: ticketsByUser.map((t) => ({
          userId: t.userId,
          tickets: (t._sum.quantity ?? 0n).toString(),
        })),
      },
    });
  }

  // No weekKey → show last 4 weeks
  const raffles = await db.raffle.findMany({
    where: { type: "CREDITS" },
    orderBy: { weekKey: "desc" },
    take: 4,
    include: {
      winners: true,
      _count: { select: { tickets: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    raffles: raffles.map((r) => ({
      weekKey: r.weekKey,
      status: r.status,
      totalTickets: r.totalTickets.toString(),
      userPool: r.userPoolCreditsMicro.toString(),
      matchPool: r.matchPoolCreditsMicro.toString(),
      rollover: r.rolloverCreditsMicro.toString(),
      closesAt: r.closesAt.toISOString(),
      drawnAt: r.drawnAt?.toISOString() ?? null,
      ticketEntries: r._count.tickets,
      winnerCount: r.winners.length,
    })),
  });
}

// ── Weighted random draw without replacement ───────────────────────
async function pickWinners(raffleId: string): Promise<string[]> {
  const grouped = await db.raffleTicket.groupBy({
    by: ["userId"],
    where: { raffleId },
    _sum: { quantity: true },
  });

  const pool = grouped
    .map((g) => ({ userId: g.userId, qty: BigInt(g._sum.quantity ?? 0) }))
    .filter((x) => x.qty > 0n);

  const winners: string[] = [];

  const pickOne = () => {
    const total = pool.reduce((a, b) => a + b.qty, 0n);
    if (total <= 0n) return null;
    const r = BigInt("0x" + crypto.randomBytes(8).toString("hex")) % total;
    let cumulative = 0n;
    for (const p of pool) {
      cumulative += p.qty;
      if (r < cumulative) return p.userId;
    }
    return pool[pool.length - 1]?.userId ?? null;
  };

  for (let i = 0; i < 3; i++) {
    const id = pickOne();
    if (!id) break;
    winners.push(id);
    const idx = pool.findIndex((p) => p.userId === id);
    if (idx >= 0) pool.splice(idx, 1);
  }

  return winners;
}

// ── POST: manually draw a missed week ──────────────────────────────
export async function POST(req: NextRequest) {
  const admin = await requireAdminOrMod();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { weekKey } = await req.json();
  if (!weekKey || typeof weekKey !== "string") {
    return NextResponse.json({ ok: false, error: "weekKey is required" }, { status: 400 });
  }

  const raffle = await db.raffle.findUnique({
    where: { weekKey_type: { weekKey, type: "CREDITS" } },
  });

  if (!raffle) {
    return NextResponse.json({ ok: false, error: `No raffle found for weekKey=${weekKey}` }, { status: 404 });
  }

  if (raffle.status === "DRAWN") {
    return NextResponse.json({ ok: false, error: "This raffle has already been drawn" }, { status: 400 });
  }

  if (raffle.totalTickets === 0n) {
    return NextResponse.json({ ok: false, error: "No tickets in this raffle — nothing to draw" }, { status: 400 });
  }

  const now = new Date();

  // Step 1: Close the raffle and apply 1:1 match
  const budget = await db.raffleMatchBudget.upsert({
    where: { weekKey },
    create: { weekKey, creditsMatchCapMicro: 0n },
    update: {},
  });

  const capRemaining =
    budget.creditsMatchCapMicro === 0n
      ? raffle.userPoolCreditsMicro
      : budget.creditsMatchCapMicro - budget.creditsMatchedMicro;
  const matchCredits =
    capRemaining > 0n
      ? raffle.userPoolCreditsMicro <= capRemaining
        ? raffle.userPoolCreditsMicro
        : capRemaining
      : 0n;

  await db.$transaction(async (tx) => {
    await tx.raffle.update({
      where: { id: raffle.id },
      data: { status: "CLOSED", matchPoolCreditsMicro: matchCredits },
    });
    await tx.raffleMatchBudget.update({
      where: { weekKey },
      data: { creditsMatchedMicro: { increment: matchCredits } },
    });
  });

  // Step 2: Draw winners
  const winners = await pickWinners(raffle.id);

  if (winners.length === 0) {
    return NextResponse.json({ ok: false, error: "No valid entrants found to pick winners from" }, { status: 400 });
  }

  const closed = await db.raffle.findUnique({ where: { id: raffle.id } });
  if (!closed) {
    return NextResponse.json({ ok: false, error: "Raffle not found after close" }, { status: 500 });
  }

  const totalCredits =
    closed.userPoolCreditsMicro + closed.matchPoolCreditsMicro + closed.rolloverCreditsMicro;

  const prizes = [
    { place: 1, pct: 50 },
    { place: 2, pct: 30 },
    { place: 3, pct: 20 },
  ];

  // Give winners 7 days from now to claim
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const winnerDetails: Array<{ userId: string; place: number; prizeCredits: string }> = [];

  await db.$transaction(async (tx) => {
    for (let i = 0; i < winners.length; i++) {
      const userId = winners[i];
      const p = prizes[i];
      const prizeCredits = (totalCredits * BigInt(p.pct)) / 100n;

      const winner = await tx.raffleWinner.create({
        data: {
          raffleId: closed.id,
          userId,
          place: p.place,
          prizeCreditsMicro: prizeCredits,
          expiresAt,
        },
      });

      const prizeCreditsDisplay = Number(prizeCredits / 1000n);
      const placeLabel = p.place === 1 ? "1st" : p.place === 2 ? "2nd" : "3rd";
      const expiryDate = expiresAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      await tx.userMessage.create({
        data: {
          userId,
          senderId: null,
          type: "SYSTEM",
          subject: `Congratulations! You won ${placeLabel} place in the Weekly Drawing!`,
          body: `You've won ${placeLabel} place in the Weekly Rewards Drawing for week ${weekKey}!\n\nYour prize: ${prizeCreditsDisplay.toLocaleString()} Special Credits\n\nClaim your prize before ${expiryDate} or it will be forfeited and rolled over to the next drawing.\n\n[WINNER_ID:${winner.id}]`,
        },
      });

      winnerDetails.push({
        userId,
        place: p.place,
        prizeCredits: prizeCredits.toString(),
      });
    }

    await tx.raffle.update({
      where: { id: closed.id },
      data: { status: "DRAWN", drawnAt: now },
    });
  });

  return NextResponse.json({
    ok: true,
    weekKey,
    totalPoolMicro: totalCredits.toString(),
    matchAppliedMicro: matchCredits.toString(),
    winners: winnerDetails,
    expiresAt: expiresAt.toISOString(),
  });
}
