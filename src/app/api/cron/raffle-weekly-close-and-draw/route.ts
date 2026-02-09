/**
 * Weekly Rewards Drawing Close and Draw
 *
 * POST /api/cron/raffle-weekly-close-and-draw
 *
 * This cron job runs weekly (Sunday midnight PT or more frequently) and:
 * 1. Ensures current week drawing exists
 * 2. Expires prev week's unclaimed winners -> rollover
 * 3. Closes OPEN drawings past close time
 * 4. Applies 1:1 match (capped by RaffleMatchBudget)
 * 5. Draws winners for closed drawings
 * 6. Creates new drawing for the next week
 *
 * Safe to run repeatedly (idempotent).
 *
 * NOTE: Special Credits have NO cash value. Winners receive Special Credits only.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { assertCronSecret } from "@/lib/cronAuth";
import crypto from "crypto";
import { raffleWeekInfo, getPrevWeekKey } from "@/lib/raffleWeekPT";
import { ensureWeekRaffles } from "@/lib/rafflesEnsure";

export const runtime = "nodejs";

// Advisory lock key for raffle cron (arbitrary stable int64)
const RAFFLE_CRON_LOCK_KEY = 8675309;

async function withPgAdvisoryLock<T>(fn: () => Promise<T>): Promise<T> {
  // Acquire advisory lock (blocks if another instance holds it)
  await db.$executeRawUnsafe(`SELECT pg_advisory_lock(${RAFFLE_CRON_LOCK_KEY})`);
  try {
    return await fn();
  } finally {
    // Release lock
    await db.$executeRawUnsafe(`SELECT pg_advisory_unlock(${RAFFLE_CRON_LOCK_KEY})`);
  }
}

function assertCron(req: Request) {
  assertCronSecret(req);
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

    // Safe random BigInt that handles any size pool (avoids crypto.randomInt overflow)
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

export async function POST(req: Request) {
  try {
    assertCron(req);

    // Wrap entire raffle logic in advisory lock to prevent concurrent runs
    return await withPgAdvisoryLock(async () => {
      const now = new Date();

      // Current drawing week (ending Sunday date key)
      const { weekKey, opensAt, closesAt, nextWeekKey, nextClosesAt } = raffleWeekInfo(now);

      // Make sure current week drawing exists
      await ensureWeekRaffles({ weekKey, opensAt, closesAt });

      // Also ensure next week exists so expiry can point to next week's close
      const nextOpensAt = new Date(opensAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      await ensureWeekRaffles({ weekKey: nextWeekKey, opensAt: nextOpensAt, closesAt: nextClosesAt });

      // Compute prev weekKey
      const prevWeekKey = getPrevWeekKey(weekKey);

      // Only CREDITS drawing now (no XESS)
      const results: Array<{
        type: string;
        weekKey: string;
        status: string;
        closesAt?: Date;
        winners?: string[];
      }> = [];

      // IMPORTANT: First check if PREVIOUS week needs to be drawn
      // This handles cases where the cron missed drawing the previous week
      const prevRaffle = await db.raffle.findUnique({ where: { weekKey_type: { weekKey: prevWeekKey, type: "CREDITS" } } });

      if (prevRaffle && prevRaffle.status === "OPEN" && now >= prevRaffle.closesAt) {
        // Previous week raffle needs to be drawn!
        console.log(`[raffle-draw] Drawing previous week ${prevWeekKey} that was missed`);

        // Close and apply match to previous week
        const budget = await db.raffleMatchBudget.upsert({
          where: { weekKey: prevWeekKey },
          create: { weekKey: prevWeekKey, creditsMatchCapMicro: 0n },
          update: {},
        });

        const capRemaining =
          budget.creditsMatchCapMicro === 0n
            ? prevRaffle.userPoolCreditsMicro
            : budget.creditsMatchCapMicro - budget.creditsMatchedMicro;
        const matchCredits =
          capRemaining > 0n
            ? prevRaffle.userPoolCreditsMicro <= capRemaining
              ? prevRaffle.userPoolCreditsMicro
              : capRemaining
            : 0n;

        await db.$transaction(async (tx) => {
          await tx.raffle.update({
            where: { id: prevRaffle.id },
            data: { status: "CLOSED", matchPoolCreditsMicro: matchCredits },
          });
          await tx.raffleMatchBudget.update({
            where: { weekKey: prevWeekKey },
            data: { creditsMatchedMicro: { increment: matchCredits } },
          });
        });

        const closedPrev = await db.raffle.findUnique({ where: { id: prevRaffle.id } });
        if (closedPrev) {
          const prevWinners = await pickWinners(closedPrev.id);

          const totalCredits =
            closedPrev.userPoolCreditsMicro + closedPrev.matchPoolCreditsMicro + closedPrev.rolloverCreditsMicro;

          const prizes = [
            { place: 1, pct: 50 },
            { place: 2, pct: 30 },
            { place: 3, pct: 20 },
          ];

          // Expiry = end of current week if we're before it, else next week
          const prevExpiresAt = now < closesAt ? closesAt : nextClosesAt;

          await db.$transaction(async (tx) => {
            for (let i = 0; i < prevWinners.length; i++) {
              const userId = prevWinners[i];
              const p = prizes[i];

              const prizeCredits = (totalCredits * BigInt(p.pct)) / 100n;

              const winner = await tx.raffleWinner.create({
                data: {
                  raffleId: closedPrev.id,
                  userId,
                  place: p.place,
                  prizeCreditsMicro: prizeCredits,
                  expiresAt: prevExpiresAt,
                },
              });

              const prizeCreditsDisplay = Number(prizeCredits / 1000n);
              const placeLabel = p.place === 1 ? "1st" : p.place === 2 ? "2nd" : "3rd";
              const expiryDate = prevExpiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

              await tx.userMessage.create({
                data: {
                  userId,
                  senderId: null,
                  type: "SYSTEM",
                  subject: `Congratulations! You won ${placeLabel} place in the Weekly Drawing!`,
                  body: `You've won ${placeLabel} place in the Weekly Rewards Drawing for week ${prevWeekKey}!\n\nYour prize: ${prizeCreditsDisplay.toLocaleString()} Special Credits\n\nClaim your prize before ${expiryDate} or it will be forfeited and rolled over to the next drawing.\n\n[WINNER_ID:${winner.id}]`,
                },
              });
            }

            await tx.raffle.update({
              where: { id: closedPrev.id },
              data: { status: "DRAWN", drawnAt: now },
            });
          });

          results.push({ type: "CREDITS", weekKey: prevWeekKey, status: "DRAWN", winners: prevWinners });
        }
      }

      const current = await db.raffle.findUnique({ where: { weekKey_type: { weekKey, type: "CREDITS" } } });
      if (!current) {
        return NextResponse.json({ ok: true, weekKey, results, message: "No CREDITS drawing found" });
      }

      // 1) Expire prev week pending winners -> rollover (only if we haven't already applied rollover to current)
      if (current.rolloverCreditsMicro === 0n) {
        const prev = await db.raffle.findUnique({ where: { weekKey_type: { weekKey: prevWeekKey, type: "CREDITS" } } });

        if (prev && prev.status === "DRAWN") {
          const expired = await db.raffleWinner.findMany({
            where: { raffleId: prev.id, status: "PENDING", expiresAt: { lt: now } },
          });

          const rollCredits = expired.reduce((a, w) => a + w.prizeCreditsMicro, 0n);

          if (expired.length) {
            await db.raffleWinner.updateMany({
              where: { raffleId: prev.id, status: "PENDING", expiresAt: { lt: now } },
              data: { status: "EXPIRED" },
            });
          }

          await db.raffle.update({
            where: { id: current.id },
            data: { rolloverCreditsMicro: rollCredits },
          });
        }
      }

      // 2) If not yet time to close, skip
      if (now < current.closesAt) {
        results.push({ type: "CREDITS", weekKey, status: "OPEN", closesAt: current.closesAt });
        return NextResponse.json({ ok: true, weekKey, results });
      }

      // 3) If already drawn, skip
      if (current.status === "DRAWN") {
        results.push({ type: "CREDITS", weekKey, status: "DRAWN" });
        return NextResponse.json({ ok: true, weekKey, results });
      }

      // 4) Close -> match -> draw
      const budget = await db.raffleMatchBudget.upsert({
        where: { weekKey },
        create: { weekKey, creditsMatchCapMicro: 0n },
        update: {},
      });

      const refreshed = await db.raffle.findUnique({ where: { id: current.id } });
      if (!refreshed) {
        return NextResponse.json({ ok: true, weekKey, results, message: "Drawing not found after refresh" });
      }

      // Calculate match (1:1). If cap is 0, treat as "match all" (no cap).
      const capRemaining =
        budget.creditsMatchCapMicro === 0n
          ? refreshed.userPoolCreditsMicro
          : budget.creditsMatchCapMicro - budget.creditsMatchedMicro;
      const matchCredits =
        capRemaining > 0n
          ? refreshed.userPoolCreditsMicro <= capRemaining
            ? refreshed.userPoolCreditsMicro
            : capRemaining
          : 0n;

      await db.$transaction(async (tx) => {
        await tx.raffle.update({
          where: { id: refreshed.id },
          data: { status: "CLOSED", matchPoolCreditsMicro: matchCredits },
        });
        await tx.raffleMatchBudget.update({
          where: { weekKey },
          data: { creditsMatchedMicro: { increment: matchCredits } },
        });
      });

      const closed = await db.raffle.findUnique({ where: { id: refreshed.id } });
      if (!closed) {
        return NextResponse.json({ ok: true, weekKey, results, message: "Drawing not found after close" });
      }

      const winners = await pickWinners(closed.id);

      // Total pool = user contributions + match + rollover (all in Special Credits micro)
      const totalCredits =
        closed.userPoolCreditsMicro + closed.matchPoolCreditsMicro + closed.rolloverCreditsMicro;

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

          // Prize is Special Credits only (no cash value)
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

          // Format prize amount for display (1 credit = 1000 microcredits)
          const prizeCreditsDisplay = Number(prizeCredits / 1000n);
          const placeLabel = p.place === 1 ? "1st" : p.place === 2 ? "2nd" : "3rd";
          const expiryDate = expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

          // Send system message to winner
          await tx.userMessage.create({
            data: {
              userId,
              senderId: null, // System message
              type: "SYSTEM",
              subject: `Congratulations! You won ${placeLabel} place in the Weekly Drawing!`,
              body: `You've won ${placeLabel} place in the Weekly Rewards Drawing for week ${weekKey}!\n\nYour prize: ${prizeCreditsDisplay.toLocaleString()} Special Credits\n\nClaim your prize before ${expiryDate} or it will be forfeited and rolled over to the next drawing.\n\n[WINNER_ID:${winner.id}]`,
            },
          });
        }

        await tx.raffle.update({
          where: { id: closed.id },
          data: { status: "DRAWN", drawnAt: now },
        });
      });

      results.push({ type: "CREDITS", weekKey, status: "DRAWN", winners });

      return NextResponse.json({ ok: true, weekKey, results });
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
