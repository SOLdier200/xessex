/**
 * Ensure rewards drawing record exists for a given week
 * (Special Credits drawing only - no XESS drawing)
 *
 * Note: Special Credits have no cash value and are not purchasable.
 */

import { db } from "@/lib/prisma";
import { DRAWING_TICKET_MICRO } from "@/lib/rewardsConstants";

export async function ensureWeekRaffles(params: {
  weekKey: string;
  opensAt: Date;
  closesAt: Date;
}) {
  const { weekKey, opensAt, closesAt } = params;

  // Create only the Special Credits drawing (no XESS drawing)
  await db.raffle.upsert({
    where: { weekKey_type: { weekKey, type: "CREDITS" } },
    create: {
      weekKey,
      type: "CREDITS",
      status: "OPEN",
      ticketPriceCreditsMicro: DRAWING_TICKET_MICRO,
      opensAt,
      closesAt,
    },
    update: { opensAt, closesAt },
  });
}
