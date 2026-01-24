/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { MANUAL_PLANS, type ManualPlanCode } from "@/lib/manualPlans";

export const runtime = "nodejs";

function makeVerifyCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "XESSEX-";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(req: Request) {
  const ctx = await getAccessContext();
  if (!ctx.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const planCode = body.planCode as ManualPlanCode | undefined;
  const payerHandle = typeof body.payerHandle === "string" ? body.payerHandle.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!planCode || !MANUAL_PLANS[planCode]) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }

  const plan = MANUAL_PLANS[planCode];

  // Diamond requires wallet to be linked before payment
  if (plan.requestedTier === "DIAMOND" && !ctx.user.walletAddress) {
    return NextResponse.json({ ok: false, error: "DIAMOND_REQUIRES_WALLET" }, { status: 400 });
  }

  // Unique verify code (try a few times)
  let verifyCode = makeVerifyCode();
  for (let i = 0; i < 5; i++) {
    const exists = await db.manualPayment.findUnique({ where: { verifyCode } });
    if (!exists) break;
    verifyCode = makeVerifyCode();
  }

  const provisionalUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  await db.$transaction(async (tx) => {
    await tx.manualPayment.create({
      data: {
        userId: ctx.user!.id,
        requestedTier: plan.requestedTier,
        planCode,
        amountUsd: plan.amountCents,
        currency: "USD",
        payerHandle: payerHandle || undefined,
        note: note || undefined,
        verifyCode,
        provisionalUntil,
      },
    });

    // Provisional is ALWAYS MEMBER (even if requesting Diamond)
    await tx.subscription.upsert({
      where: { userId: ctx.user!.id },
      create: {
        userId: ctx.user!.id,
        tier: "MEMBER",
        status: "PARTIAL",
        expiresAt: provisionalUntil,
        cancelAtPeriodEnd: false,
      },
      update: {
        // Never grant diamond here - provisional is always MEMBER
        tier: "MEMBER",
        status: "PARTIAL",
        expiresAt: provisionalUntil,
        cancelAtPeriodEnd: false,
        // leave nowpayments fields untouched (don't overwrite)
      },
    });
  });

  return NextResponse.json({
    ok: true,
    verifyCode,
    provisionalUntil,
    requestedTier: plan.requestedTier,
  });
}
