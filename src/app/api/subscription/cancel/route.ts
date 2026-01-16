/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

/**
 * POST /api/subscription/cancel
 * Marks the user's subscription to cancel at the end of the current period.
 * Does NOT revoke access immediately - user keeps access until expiresAt.
 */
export async function POST() {
  const access = await getAccessContext();
  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const sub = await db.subscription.findUnique({
    where: { userId: access.user.id },
  });

  if (!sub) {
    return NextResponse.json({ ok: false, error: "NO_SUBSCRIPTION" }, { status: 404 });
  }

  if (sub.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, error: "NOT_ACTIVE" }, { status: 400 });
  }

  if (sub.cancelAtPeriodEnd) {
    return NextResponse.json({ ok: false, error: "ALREADY_CANCELED" }, { status: 400 });
  }

  await db.subscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: true },
  });

  console.log(`[Subscription] User ${access.user.id} requested cancellation, access until ${sub.expiresAt?.toISOString()}`);

  return NextResponse.json({
    ok: true,
    cancelAtPeriodEnd: true,
    expiresAt: sub.expiresAt?.toISOString() || null,
  });
}
