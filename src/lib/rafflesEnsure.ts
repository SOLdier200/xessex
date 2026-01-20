/**
 * Ensure raffle records exist for a given week
 */

import { db } from "@/lib/prisma";
import { RAFFLE_CREDIT_TICKET_MICRO, RAFFLE_XESS_TICKET_ATOMIC } from "@/lib/rewardsConstants";

export async function ensureWeekRaffles(params: {
  weekKey: string;
  opensAt: Date;
  closesAt: Date;
}) {
  const { weekKey, opensAt, closesAt } = params;

  await db.raffle.upsert({
    where: { weekKey_type: { weekKey, type: "CREDITS" } },
    create: {
      weekKey,
      type: "CREDITS",
      status: "OPEN",
      ticketPriceCreditsMicro: RAFFLE_CREDIT_TICKET_MICRO,
      opensAt,
      closesAt,
    },
    update: { opensAt, closesAt },
  });

  await db.raffle.upsert({
    where: { weekKey_type: { weekKey, type: "XESS" } },
    create: {
      weekKey,
      type: "XESS",
      status: "OPEN",
      ticketPriceXessAtomic: RAFFLE_XESS_TICKET_ATOMIC,
      opensAt,
      closesAt,
    },
    update: { opensAt, closesAt },
  });
}
