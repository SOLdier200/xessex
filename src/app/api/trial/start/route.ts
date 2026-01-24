/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { getCurrentUser, isSubscriptionActive } from "@/lib/auth";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TRIAL_DURATION_DAYS = 14;

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function POST() {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401, headers: noCache });
    }

    // One trial per account
    if (user.trialUsed) {
      return NextResponse.json({ ok: false, error: "TRIAL_ALREADY_USED" }, { status: 409, headers: noCache });
    }

    // Block ONLY if truly active (ACTIVE/TRIAL and not expired). Do NOT block on PENDING/PARTIAL.
    if (isSubscriptionActive(user.subscription)) {
      return NextResponse.json({ ok: false, error: "ALREADY_SUBSCRIBED" }, { status: 409, headers: noCache });
    }

    const now = new Date();
    const trialEndsAt = addDays(now, TRIAL_DURATION_DAYS);

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          trialUsed: true,
          trialStartedAt: now,
          trialEndsAt,
        },
      });

      await tx.subscription.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          tier: "MEMBER",
          status: "TRIAL",
          expiresAt: trialEndsAt,
          paymentMethod: "CRYPTO", // placeholder; trial has no payment
          cancelAtPeriodEnd: true,
        },
        update: {
          tier: "MEMBER",
          status: "TRIAL",
          expiresAt: trialEndsAt,
          cancelAtPeriodEnd: true,
        },
      });
    });

    return NextResponse.json(
      {
        ok: true,
        trialEndsAt: trialEndsAt.toISOString(),
        daysRemaining: TRIAL_DURATION_DAYS,
      },
      { headers: noCache }
    );
  } catch (err) {
    console.error("[trial/start] Error:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, headers: noCache });
  }
}
