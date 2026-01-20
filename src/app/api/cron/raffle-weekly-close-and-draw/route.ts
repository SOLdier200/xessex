/**
 * Weekly Raffle Close and Draw
 *
 * POST /api/cron/raffle-weekly-close-and-draw
 *
 * This cron job runs weekly (Sunday midnight PT or more frequently) and:
 * 1. Ensures current week raffles exist
 * 2. Expires prev week's unclaimed winners -> rollover
 * 3. Closes OPEN raffles past close time
 * 4. Applies 1:1 match (capped by RaffleMatchBudget)
 * 5. Draws winners for closed raffles
 * 6. Creates new raffles for the next week
 *
 * Safe to run repeatedly (idempotent).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import crypto from "crypto";
import { raffleWeekInfo, getPrevWeekKey } from "@/lib/raffleWeekPT";
import { ensureWeekRaffles } from "@/lib/rafflesEnsure";

export const runtime = "nodejs";

function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("x-cron-secret") || "";
  if (!secret || got !== secret) throw new Error("unauthorized");
}

// Simple weighted draw without replacement
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

    // NOTE: assumes total fits in Number. For typical scale this is fine.
    const r = BigInt(crypto.randomInt(0, Number(total)));
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

export async function POST(req: Request) {
  try {
    assertCron(req);

    const now = new Date();

    // Current raffle week (ending Sunday date key)
    const { weekKey, opensAt, closesAt, nextWeekKey, nextClosesAt } = raffleWeekInfo(now);

    // Make sure current week raffles exist
    await ensureWeekRaffles({ weekKey, opensAt, closesAt });

    // Also ensure next week exists so expiry can point to next week's close
    const nextOpensAt = new Date(opensAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    await ensureWeekRaffles({ weekKey: nextWeekKey, opensAt: nextOpensAt, closesAt: nextClosesAt });

    // Compute prev weekKey
    const prevWeekKey = getPrevWeekKey(weekKey);

    const types: Array<"CREDITS" | "XESS"> = ["CREDITS", "XESS"];
    const results: Array<{
      type: string;
      weekKey: string;
      status: string;
      closesAt?: Date;
      winners?: string[];
    }> = [];

    for (const type of types) {
      const current = await db.raffle.findUnique({ where: { weekKey_type: { weekKey, type } } });
      if (!current) continue;

      // 1) Expire prev week pending winners -> rollover (only if we haven't already applied rollover to current)
      if (
        (type === "CREDITS" && current.rolloverCreditsMicro === 0n) ||
        (type === "XESS" && current.rolloverXessAtomic === 0n)
      ) {
        const prev = await db.raffle.findUnique({ where: { weekKey_type: { weekKey: prevWeekKey, type } } });

        if (prev) {
          const expired = await db.raffleWinner.findMany({
            where: { raffleId: prev.id, status: "PENDING", expiresAt: { lt: now } },
          });

          const rollCredits = expired.reduce((a, w) => a + w.prizeCreditsMicro, 0n);
          const rollXess = expired.reduce((a, w) => a + w.prizeXessAtomic, 0n);

          if (expired.length) {
            await db.raffleWinner.updateMany({
              where: { raffleId: prev.id, status: "PENDING", expiresAt: { lt: now } },
              data: { status: "EXPIRED" },
            });
          }

          await db.raffle.update({
            where: { id: current.id },
            data: {
              rolloverCreditsMicro: type === "CREDITS" ? rollCredits : current.rolloverCreditsMicro,
              rolloverXessAtomic: type === "XESS" ? rollXess : current.rolloverXessAtomic,
            },
          });
        }
      }

      // 2) If not yet time to close, skip
      if (now < current.closesAt) {
        results.push({ type, weekKey, status: "OPEN", closesAt: current.closesAt });
        continue;
      }

      // 3) If already drawn, skip
      if (current.status === "DRAWN") {
        results.push({ type, weekKey, status: "DRAWN" });
        continue;
      }

      // 4) Close -> match -> draw
      const budget = await db.raffleMatchBudget.upsert({
        where: { weekKey },
        create: { weekKey, creditsMatchCapMicro: 0n, xessMatchCapAtomic: 0n },
        update: {},
      });

      const refreshed = await db.raffle.findUnique({ where: { id: current.id } });
      if (!refreshed) continue;

      let matchCredits = 0n;
      let matchXess = 0n;

      if (type === "CREDITS") {
        const capRemaining = budget.creditsMatchCapMicro - budget.creditsMatchedMicro;
        matchCredits =
          capRemaining > 0n
            ? refreshed.userPoolCreditsMicro <= capRemaining
              ? refreshed.userPoolCreditsMicro
              : capRemaining
            : 0n;
      } else {
        const capRemaining = budget.xessMatchCapAtomic - budget.xessMatchedAtomic;
        matchXess =
          capRemaining > 0n
            ? refreshed.userPoolXessAtomic <= capRemaining
              ? refreshed.userPoolXessAtomic
              : capRemaining
            : 0n;
      }

      await db.$transaction(async (tx) => {
        if (type === "CREDITS") {
          await tx.raffle.update({
            where: { id: refreshed.id },
            data: { status: "CLOSED", matchPoolCreditsMicro: matchCredits },
          });
          await tx.raffleMatchBudget.update({
            where: { weekKey },
            data: { creditsMatchedMicro: { increment: matchCredits } },
          });
        } else {
          await tx.raffle.update({
            where: { id: refreshed.id },
            data: { status: "CLOSED", matchPoolXessAtomic: matchXess },
          });
          await tx.raffleMatchBudget.update({
            where: { weekKey },
            data: { xessMatchedAtomic: { increment: matchXess } },
          });
        }
      });

      const closed = await db.raffle.findUnique({ where: { id: refreshed.id } });
      if (!closed) continue;

      const winners = await pickWinners(closed.id);

      const totalCredits =
        closed.userPoolCreditsMicro + closed.matchPoolCreditsMicro + closed.rolloverCreditsMicro;
      const totalXess =
        closed.userPoolXessAtomic + closed.matchPoolXessAtomic + closed.rolloverXessAtomic;

      const prizes = [
        { place: 1, pct: 50 },
        { place: 2, pct: 30 },
        { place: 3, pct: 20 },
      ];

      // Expiry = end of next week (so they have one full week to claim)
      const expiresAt = nextClosesAt;

      await db.$transaction(async (tx) => {
        for (let i = 0; i < winners.length; i++) {
          const userId = winners[i];
          const p = prizes[i];

          const prizeCredits = type === "CREDITS" ? (totalCredits * BigInt(p.pct)) / 100n : 0n;
          const prizeX = type === "XESS" ? (totalXess * BigInt(p.pct)) / 100n : 0n;

          await tx.raffleWinner.create({
            data: {
              raffleId: closed.id,
              userId,
              place: p.place,
              prizeCreditsMicro: prizeCredits,
              prizeXessAtomic: prizeX,
              expiresAt,
            },
          });
        }

        await tx.raffle.update({
          where: { id: closed.id },
          data: { status: "DRAWN", drawnAt: now },
        });
      });

      results.push({ type, weekKey, status: "DRAWN", winners });
    }

    return NextResponse.json({ ok: true, weekKey, results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
