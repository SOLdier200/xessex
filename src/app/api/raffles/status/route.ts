/**
 * Raffle Status API
 *
 * GET /api/raffles/status
 *
 * Returns current raffle state for UI including:
 * - User's credit balance and membership info
 * - Pool breakdown (user + match + rollover + total)
 * - User's tickets and win probability (chanceAnyPct only)
 * - Pending wins
 * - Previous winners
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { raffleWeekInfo, getPrevWeekKey } from "@/lib/raffleWeekPT";
import { ensureWeekRaffles } from "@/lib/rafflesEnsure";
import { chanceAnyPrizePct } from "@/lib/raffleOdds";

export const runtime = "nodejs";

function formatMicroCredits(micro: bigint): string {
  const val = Number(micro) / 1000;
  if (val === Math.floor(val)) return val.toFixed(0) + " Credits";
  return val.toFixed(2) + " Credits";
}

function formatXessAtomic(atomic: bigint): string {
  const val = Number(atomic) / 1_000_000_000;
  if (val === Math.floor(val)) return val.toFixed(0) + " XESS";
  return val.toFixed(2) + " XESS";
}

function formatProbability(pct: number): string {
  if (pct === 0) return "0%";
  if (pct >= 100) return "100%";
  if (pct < 0.01) return "<0.01%";
  if (pct < 1) return pct.toFixed(2) + "%";
  return pct.toFixed(1) + "%";
}

export async function GET() {
  const ctx = await getAccessContext();

  const now = new Date();
  const { weekKey, opensAt, closesAt } = raffleWeekInfo(now);
  await ensureWeekRaffles({ weekKey, opensAt, closesAt });

  // User info (null if not logged in)
  let user: {
    id: string;
    tier: string;
    isDiamond: boolean;
    hasLinkedWallet: boolean;
    creditBalance: string;
    creditBalanceFormatted: string;
  } | null = null;

  let acct: { balanceMicro: bigint } | null = null;
  let userCreditTickets = 0n;
  let userXessTickets = 0n;

  if (ctx.user?.id) {
    const userId = ctx.user.id;

    // Get user subscription and account info
    const [dbUser, specialAcct] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, solWallet: true, subscription: { select: { tier: true, status: true } } },
      }),
      db.specialCreditAccount.findUnique({ where: { userId } }),
    ]);

    acct = specialAcct;

    const tier =
      dbUser?.subscription?.status === "ACTIVE"
        ? dbUser.subscription.tier === "DIAMOND"
          ? "diamond"
          : "member"
        : "free";

    user = {
      id: userId,
      tier,
      isDiamond: tier === "diamond",
      hasLinkedWallet: !!dbUser?.solWallet,
      creditBalance: (specialAcct?.balanceMicro ?? 0n).toString(),
      creditBalanceFormatted: formatMicroCredits(specialAcct?.balanceMicro ?? 0n),
    };
  }

  // Fetch raffles
  const [creditsRaffle, xessRaffle] = await Promise.all([
    db.raffle.findUnique({ where: { weekKey_type: { weekKey, type: "CREDITS" } } }),
    db.raffle.findUnique({ where: { weekKey_type: { weekKey, type: "XESS" } } }),
  ]);

  // User tickets (if logged in)
  if (ctx.user?.id) {
    const [creditAgg, xessAgg] = await Promise.all([
      creditsRaffle
        ? db.raffleTicket.aggregate({
            where: { raffleId: creditsRaffle.id, userId: ctx.user.id },
            _sum: { quantity: true },
          })
        : null,
      xessRaffle
        ? db.raffleTicket.aggregate({
            where: { raffleId: xessRaffle.id, userId: ctx.user.id },
            _sum: { quantity: true },
          })
        : null,
    ]);
    userCreditTickets = BigInt(creditAgg?._sum.quantity ?? 0);
    userXessTickets = BigInt(xessAgg?._sum.quantity ?? 0);
  }

  // Get unique user counts
  const [creditUsersCount, xessUsersCount] = await Promise.all([
    creditsRaffle
      ? db.raffleTicket.groupBy({ by: ["userId"], where: { raffleId: creditsRaffle.id } }).then((g) => g.length)
      : 0,
    xessRaffle
      ? db.raffleTicket.groupBy({ by: ["userId"], where: { raffleId: xessRaffle.id } }).then((g) => g.length)
      : 0,
  ]);

  // Calculate win probabilities
  const creditChance = creditsRaffle
    ? chanceAnyPrizePct(userCreditTickets, creditsRaffle.totalTickets)
    : 0;
  const xessChance = xessRaffle ? chanceAnyPrizePct(userXessTickets, xessRaffle.totalTickets) : 0;

  // Build credits raffle response
  const buildRaffleResponse = (
    raffle: typeof creditsRaffle,
    type: "credits" | "xess",
    userTickets: bigint,
    chance: number,
    usersCount: number
  ) => {
    if (!raffle) return null;

    const isCredits = type === "credits";
    const userPool = isCredits ? raffle.userPoolCreditsMicro : raffle.userPoolXessAtomic;
    const matchPool = isCredits ? raffle.matchPoolCreditsMicro : raffle.matchPoolXessAtomic;
    const rollover = isCredits ? raffle.rolloverCreditsMicro : raffle.rolloverXessAtomic;
    const total = userPool + matchPool + rollover;

    const formatFn = isCredits ? formatMicroCredits : formatXessAtomic;

    return {
      id: raffle.id,
      status: raffle.status,
      userPoolAtomic: userPool.toString(),
      matchPoolAtomic: matchPool.toString(),
      rolloverAtomic: rollover.toString(),
      totalPoolAtomic: total.toString(),
      totalPoolFormatted: formatFn(total),
      prizes: {
        first: ((total * 50n) / 100n).toString(),
        second: ((total * 30n) / 100n).toString(),
        third: ((total * 20n) / 100n).toString(),
      },
      totalTickets: Number(raffle.totalTickets),
      totalUsers: usersCount,
      userTickets: Number(userTickets),
      winProbability: chance,
      winProbabilityFormatted: formatProbability(chance),
      ticketPriceMicro: isCredits ? raffle.ticketPriceCreditsMicro?.toString() : undefined,
      ticketPriceAtomic: !isCredits ? raffle.ticketPriceXessAtomic?.toString() : undefined,
    };
  };

  // Pending wins (for claim button)
  const pendingWins = ctx.user?.id
    ? await db.raffleWinner.findMany({
        where: { userId: ctx.user.id, status: "PENDING" },
        include: { raffle: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Previous winners (last 30 weeks)
  // Build list of week keys going back 30 weeks
  const weekKeys: string[] = [];
  let wk = weekKey;
  for (let i = 0; i < 30; i++) {
    wk = getPrevWeekKey(wk);
    weekKeys.push(wk);
  }

  const previousWinners = await db.raffleWinner.findMany({
    where: {
      raffle: {
        weekKey: { in: weekKeys },
        status: "DRAWN",
      },
    },
    include: {
      raffle: true,
      user: { select: { id: true, email: true, walletAddress: true } },
    },
    orderBy: [{ raffle: { weekKey: "desc" } }, { place: "asc" }],
    take: 180, // 30 weeks * 2 raffle types * 3 places = 180 max
  });

  return NextResponse.json({
    ok: true,
    weekKey,
    closesAt: closesAt.toISOString(),
    user,
    credits: buildRaffleResponse(creditsRaffle, "credits", userCreditTickets, creditChance, creditUsersCount),
    xess: buildRaffleResponse(xessRaffle, "xess", userXessTickets, xessChance, xessUsersCount),
    pendingWins: pendingWins.map((w) => ({
      winnerId: w.id,
      raffleType: w.raffle.type,
      weekKey: w.raffle.weekKey,
      place: w.place,
      prizeCreditsMicro: w.prizeCreditsMicro.toString(),
      prizeXessAtomic: w.prizeXessAtomic.toString(),
      expiresAt: w.expiresAt.toISOString(),
    })),
    previousWinners: previousWinners.map((w) => {
      // Anonymize display name
      let displayName = "Anonymous";
      if (w.user.email) {
        const [local] = w.user.email.split("@");
        displayName = local.slice(0, 3) + "***";
      } else if (w.user.walletAddress) {
        displayName = w.user.walletAddress.slice(0, 4) + "..." + w.user.walletAddress.slice(-4);
      }

      return {
        weekKey: w.raffle.weekKey,
        type: w.raffle.type,
        place: w.place,
        prizeAtomic:
          w.raffle.type === "CREDITS" ? w.prizeCreditsMicro.toString() : w.prizeXessAtomic.toString(),
        status: w.status,
        displayName,
      };
    }),
  });
}
