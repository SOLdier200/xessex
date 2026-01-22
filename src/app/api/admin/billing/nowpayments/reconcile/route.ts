/*
 * POST /api/admin/billing/nowpayments/reconcile
 *
 * Manually activates a subscription that was paid but IPN never arrived.
 * Protected by CRON_SECRET header (x-cron-secret).
 *
 * Usage:
 *   curl -sS -X POST "https://xessex.me/api/admin/billing/nowpayments/reconcile?order_id=sx_D1_xxx&payment_id=123" \
 *     -H "x-cron-secret: YOUR_SECRET"
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

type PlanCode = "M90" | "MY" | "D1" | "D2" | "DY";

const PLAN_META: Record<PlanCode, { tier: "MEMBER" | "DIAMOND"; days: number }> = {
  M90: { tier: "MEMBER", days: 90 },
  MY:  { tier: "MEMBER", days: 365 },
  D1:  { tier: "DIAMOND", days: 30 },
  D2:  { tier: "DIAMOND", days: 60 },
  DY:  { tier: "DIAMOND", days: 365 },
};

function planFromOrderId(orderId: string | null): PlanCode | null {
  if (!orderId) return null;
  const match = orderId.match(/^sx_(M90|MY|D1|D2|DY)_/i);
  if (!match) return null;
  return match[1].toUpperCase() as PlanCode;
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function POST(req: NextRequest) {
  // Verify CRON_SECRET
  const secret = process.env.CRON_SECRET || "";
  const authHeader = req.headers.get("x-cron-secret") || "";

  if (!secret || authHeader !== secret) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const orderId = (sp.get("order_id") || "").trim();
  const paymentId = (sp.get("payment_id") || "").trim();
  const txHash = (sp.get("tx") || "").trim();

  if (!orderId) {
    return NextResponse.json({ ok: false, error: "MISSING_ORDER_ID" }, { status: 400 });
  }

  // Find the subscription by order_id
  const sub = await db.subscription.findUnique({
    where: { nowPaymentsOrderId: orderId },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!sub) {
    // Check if it's in unlinked table
    const unlinked = await db.nowPaymentsUnlinked.findFirst({
      where: { nowPaymentsOrderId: orderId },
    });

    return NextResponse.json({
      ok: false,
      error: "SUB_NOT_FOUND",
      hint: unlinked
        ? "Found in NowPaymentsUnlinked table - payment arrived but subscription record is missing"
        : "No record found with this order_id",
    }, { status: 404 });
  }

  // Extract plan from order_id
  const planCode = planFromOrderId(orderId);
  if (!planCode) {
    return NextResponse.json({
      ok: false,
      error: "INVALID_ORDER_ID_FORMAT",
      hint: "order_id must be like sx_D1_xxx",
    }, { status: 400 });
  }

  const plan = PLAN_META[planCode];

  // Calculate expiry
  const now = new Date();
  const base =
    sub.status === "ACTIVE" && sub.expiresAt && sub.expiresAt.getTime() > now.getTime()
      ? sub.expiresAt
      : now;

  const newExpiry = addDays(base, plan.days);

  // Activate the subscription
  const updated = await db.subscription.update({
    where: { id: sub.id },
    data: {
      tier: plan.tier,
      status: "ACTIVE",
      expiresAt: newExpiry,
      nowPaymentsPaymentId: paymentId || sub.nowPaymentsPaymentId,
      lastTxSig: txHash || sub.lastTxSig,
    },
  });

  // Mark as reconciled in unlinked table if present
  await db.nowPaymentsUnlinked.updateMany({
    where: { nowPaymentsOrderId: orderId },
    data: {
      reconciledAt: now,
      reconciledSubId: sub.id,
    },
  }).catch(() => {
    // Table might not have those fields or row doesn't exist
  });

  console.log(`[RECONCILE] Activated subscription ${sub.id} for user ${sub.user?.email}: tier=${plan.tier}, expires=${newExpiry.toISOString()}`);

  return NextResponse.json({
    ok: true,
    activated: true,
    subscription: {
      id: updated.id,
      userId: updated.userId,
      userEmail: sub.user?.email,
      tier: updated.tier,
      status: updated.status,
      expiresAt: updated.expiresAt?.toISOString() ?? null,
      nowPaymentsOrderId: updated.nowPaymentsOrderId,
      nowPaymentsPaymentId: updated.nowPaymentsPaymentId,
    },
    plan: planCode,
    daysGranted: plan.days,
  });
}
