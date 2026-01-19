/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { MANUAL_PLANS, type ManualPlanCode } from "@/lib/manualPlans";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAccessContext();
  if (!ctx.isAdminOrMod) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  const mp = await db.manualPayment.findUnique({ where: { id } });
  if (!mp) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (mp.status !== "PENDING") return NextResponse.json({ error: "not_pending" }, { status: 400 });

  const plan = MANUAL_PLANS[mp.planCode as ManualPlanCode];
  if (!plan) return NextResponse.json({ error: "unknown_plan" }, { status: 400 });

  const expiresAt = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);

  await db.$transaction(async (tx) => {
    await tx.manualPayment.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedBy: ctx.user?.id || undefined,
      },
    });

    await tx.subscription.upsert({
      where: { userId: mp.userId },
      create: {
        userId: mp.userId,
        tier: mp.requestedTier, // MEMBER or DIAMOND
        status: "ACTIVE",
        expiresAt,
        cancelAtPeriodEnd: false,
      },
      update: {
        tier: mp.requestedTier,
        status: "ACTIVE",
        expiresAt,
        cancelAtPeriodEnd: false,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
