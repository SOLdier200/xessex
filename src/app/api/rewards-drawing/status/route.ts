/**
 * Rewards Drawing Status API
 *
 * GET /api/rewards-drawing/status
 *
 * Returns current drawing state for UI including:
 * - User's credit balance
 * - Pool breakdown (user + match + rollover + total)
 * - User's entries and win probability
 * - Pending wins (credits only - no XESS)
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { raffleWeekInfo } from "@/lib/raffleWeekPT";
import { ensureWeekRaffles } from "@/lib/rafflesEnsure";
import { chanceAnyPrizePct } from "@/lib/raffleOdds";

export const runtime = "nodejs";

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 2)}***@${domain}`;
}

function truncateWallet(address: string | null): string | null {
  if (!address) return null;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export async function GET() {
  const ctx = await getAccessContext();

  const now = new Date();
  const { weekKey, opensAt, closesAt } = raffleWeekInfo(now);
  await ensureWeekRaffles({ weekKey, opensAt, closesAt });

  // Get user's credit balance
  let creditsBalanceMicro = "0";

  if (ctx.user?.id) {
    const specialAcct = await db.specialCreditAccount.findUnique({
      where: { userId: ctx.user.id },
    });
    creditsBalanceMicro = (specialAcct?.balanceMicro ?? 0n).toString();
  }

  // Fetch credits drawing only (no XESS)
  const creditsRaffle = await db.raffle.findUnique({
    where: { weekKey_type: { weekKey, type: "CREDITS" } },
  });

  // User's entries (if logged in)
  let userTickets = 0n;
  if (ctx.user?.id && creditsRaffle) {
    const agg = await db.raffleTicket.aggregate({
      where: { raffleId: creditsRaffle.id, userId: ctx.user.id },
      _sum: { quantity: true },
    });
    userTickets = BigInt(agg._sum.quantity ?? 0);
  }

  // Calculate win probability
  const chanceAnyPct = creditsRaffle
    ? chanceAnyPrizePct(userTickets, creditsRaffle.totalTickets)
    : 0;

  // Build drawing response
  let drawing = null;
  if (creditsRaffle) {
    const userPool = creditsRaffle.userPoolCreditsMicro;
    const matchPool = creditsRaffle.matchPoolCreditsMicro;
    const rollover = creditsRaffle.rolloverCreditsMicro;
    const total = userPool + matchPool + rollover;

    drawing = {
      id: creditsRaffle.id,
      status: creditsRaffle.status,
      ticketPriceMicro: creditsRaffle.ticketPriceCreditsMicro?.toString() ?? null,
      totalTickets: creditsRaffle.totalTickets.toString(),
      yourTickets: userTickets.toString(),
      chanceAnyPct,
      pools: {
        user: userPool.toString(),
        match: matchPool.toString(),
        rollover: rollover.toString(),
        total: total.toString(),
      },
    };
  }

  // Pending wins (credits only) — with lazy expiry
  let pendingWins: Awaited<ReturnType<typeof db.raffleWinner.findMany>> = [];
  let expiredWins: Array<{
    winnerId: string;
    weekKey: string;
    place: number;
    prizeCreditsMicro: string;
    expiredAt: string;
  }> = [];

  if (ctx.user?.id) {
    const rawPending = await db.raffleWinner.findMany({
      where: {
        userId: ctx.user.id,
        status: "PENDING",
        raffle: { type: "CREDITS" },
      },
      include: { raffle: true },
      orderBy: { createdAt: "desc" },
    });

    // Split into truly-pending vs past-expiry
    const stillPending: typeof rawPending = [];
    const nowExpiredIds: string[] = [];
    for (const w of rawPending) {
      if (w.expiresAt < now) {
        nowExpiredIds.push(w.id);
      } else {
        stillPending.push(w);
      }
    }

    // Lazy-mark expired ones (same as cron would do)
    if (nowExpiredIds.length > 0) {
      await db.raffleWinner.updateMany({
        where: { id: { in: nowExpiredIds } },
        data: { status: "EXPIRED" },
      });
    }

    pendingWins = stillPending;

    // Fetch user's EXPIRED wins (last 6 weeks) for history display
    const expiredRows = await db.raffleWinner.findMany({
      where: {
        userId: ctx.user.id,
        status: "EXPIRED",
        raffle: { type: "CREDITS" },
      },
      include: { raffle: true },
      orderBy: { createdAt: "desc" },
      take: 18,
    });

    expiredWins = expiredRows.map((w) => ({
      winnerId: w.id,
      weekKey: w.raffle.weekKey,
      place: w.place,
      prizeCreditsMicro: w.prizeCreditsMicro.toString(),
      expiredAt: w.expiresAt.toISOString(),
    }));
  }

  // Recent winners (last 6 weeks, credits only)
  const recentWinners = await db.raffleWinner.findMany({
    where: {
      raffle: { type: "CREDITS" },
    },
    include: {
      raffle: { select: { weekKey: true } },
      user: { select: { id: true, username: true, email: true, walletAddress: true } },
    },
    orderBy: [{ raffle: { weekKey: "desc" } }, { place: "asc" }],
    take: 18, // 6 weeks * 3 places
  });

  const winnersByWeek = new Map<string, Array<{
    place: number;
    prizeCreditsMicro: string;
    status: string;
    label: string | null;
  }>>();

  for (const w of recentWinners) {
    const week = w.raffle.weekKey;
    const label =
      w.user.username ||
      truncateWallet(w.user.walletAddress) ||
      maskEmail(w.user.email) ||
      `${w.user.id.slice(0, 8)}...`;

    const arr = winnersByWeek.get(week) || [];
    arr.push({
      place: w.place,
      prizeCreditsMicro: w.prizeCreditsMicro.toString(),
      status: w.status,
      label,
    });
    winnersByWeek.set(week, arr);
  }

  return NextResponse.json({
    ok: true,
    weekKey,
    closesAt: closesAt.toISOString(),
    creditsBalanceMicro,
    drawing,
    pendingWins: pendingWins.map((w) => ({
      winnerId: w.id,
      weekKey: w.raffle.weekKey,
      place: w.place,
      prizeCreditsMicro: w.prizeCreditsMicro.toString(),
      expiresAt: w.expiresAt.toISOString(),
    })),
    expiredWins,
    recentWinners: Array.from(winnersByWeek.entries()).map(([week, winners]) => ({
      weekKey: week,
      winners,
    })),
    rules: {
      creditsPurchasable: false,
      creditsCashValue: false,
      creditsConvertibleToToken: false,
      creditsWithdrawable: false,
      creditsRedeemableForMoney: false,
      allowedUses: ["REWARDS_DRAWING_TICKETS", "MEMBERSHIP_MONTHS_ONLY"],
    },
  });
}
