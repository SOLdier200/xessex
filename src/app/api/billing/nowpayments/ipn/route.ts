import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

type PlanCode = "MM" | "MY" | "DM" | "DY";

// Static invoice mapping (source of truth for tier + duration)
const IID_TO_PLAN = new Map<string, { tier: "MEMBER" | "DIAMOND"; days: number }>([
  ["4346120539", { tier: "MEMBER", days: 30 }],   // Member monthly $3
  ["4770954653", { tier: "MEMBER", days: 365 }],  // Member yearly $30
  ["6120974427", { tier: "DIAMOND", days: 30 }],  // Diamond monthly $18.5
  ["4296776562", { tier: "DIAMOND", days: 365 }], // Diamond yearly $185
]);

const PLAN_META: Record<PlanCode, { tier: "MEMBER" | "DIAMOND"; days: number }> = {
  MM: { tier: "MEMBER", days: 30 },
  MY: { tier: "MEMBER", days: 365 },
  DM: { tier: "DIAMOND", days: 30 },
  DY: { tier: "DIAMOND", days: 365 },
};

function planFromOrderId(orderId: string | null): PlanCode | null {
  if (!orderId) return null;
  const match = orderId.match(/^sx_(MM|MY|DM|DY)_/i);
  if (!match) return null;
  return match[1].toUpperCase() as PlanCode;
}

/**
 * Recursively sort object keys for HMAC verification.
 * NOWPayments requires sorted keys for signature verification.
 */
function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  return Object.keys(obj as Record<string, unknown>)
    .sort()
    .reduce((acc: Record<string, unknown>, k) => {
      acc[k] = sortKeys((obj as Record<string, unknown>)[k]);
      return acc;
    }, {});
}

/**
 * Timing-safe hex string comparison
 */
function safeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verify NOWPayments IPN signature.
 * HMAC SHA-512 of sorted JSON payload compared to x-nowpayments-sig header.
 */
function verifySig(rawJson: string, sig: string, secret: string): boolean {
  try {
    const parsed = JSON.parse(rawJson);
    const sorted = sortKeys(parsed);
    const payload = JSON.stringify(sorted);
    const digest = crypto.createHmac("sha512", secret).update(payload).digest("hex");
    return safeEqualHex(digest, sig);
  } catch {
    return false;
  }
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Only grant access on "finished" status (safest).
 * Other statuses: waiting, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired
 */
function isFinalPaid(status: string): boolean {
  return status === "finished";
}

/**
 * POST /api/billing/nowpayments/ipn
 * Receives IPN callbacks from NOWPayments when payment status changes.
 * Verifies signature, then updates subscription status.
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get("x-nowpayments-sig") || "";
  const secret = process.env.NOWPAYMENTS_IPN_SECRET || "";

  // Read raw body for signature verification
  const raw = await req.text();

  if (!sig || !secret) {
    console.error("[IPN] Missing signature or secret");
    return NextResponse.json({ ok: false, error: "MISSING_SIG_OR_SECRET" }, { status: 400 });
  }

  if (!verifySig(raw, sig, secret)) {
    console.error("[IPN] Invalid signature");
    return NextResponse.json({ ok: false, error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  const payload = JSON.parse(raw);

  // IPN payload fields
  const paymentStatus = String(payload.payment_status || "").toLowerCase();
  const paymentId = payload.payment_id ? String(payload.payment_id) : null;
  const orderId = payload.order_id ? String(payload.order_id) : null;

  // For hosted invoice links (iid=...), IPN includes invoice_id
  const invoiceId =
    payload.invoice_id ? String(payload.invoice_id) :
    payload.iid ? String(payload.iid) :
    null;

  console.log(`[IPN] Received: status=${paymentStatus}, orderId=${orderId}, invoiceId=${invoiceId}, paymentId=${paymentId}`);

  if (!paymentStatus) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Correlate safely (priority order):
  // 1) order_id (unique per checkout attempt - most reliable)
  // 2) payment_id (unique per payment)
  // 3) invoice_id (UNSAFE as fallback - multiple users share same iid)
  let sub = null as Awaited<ReturnType<typeof db.subscription.findFirst>>;

  if (orderId) {
    sub = await db.subscription.findUnique({
      where: { nowPaymentsOrderId: orderId },
    });
  }

  if (!sub && paymentId) {
    sub = await db.subscription.findFirst({
      where: { nowPaymentsPaymentId: paymentId },
    });
  }

  if (!sub && invoiceId) {
    // Fallback only; log warning as this is not unique across users
    console.warn("[IPN] Falling back to invoiceId correlation (not unique!)", { invoiceId });
    sub = await db.subscription.findFirst({
      where: { nowPaymentsInvoiceId: invoiceId },
    });
  }

  // If not found, acknowledge to prevent retries but log it
  if (!sub) {
    console.warn(`[IPN] No subscription found for orderId=${orderId}, invoiceId=${invoiceId}, paymentId=${paymentId}`);
    return NextResponse.json({ ok: true, unlinked: true });
  }

  // Store latest provider ids for debugging
  await db.subscription.update({
    where: { id: sub.id },
    data: {
      nowPaymentsOrderId: orderId ?? sub.nowPaymentsOrderId,
      nowPaymentsInvoiceId: invoiceId ?? sub.nowPaymentsInvoiceId,
      nowPaymentsPaymentId: paymentId ?? sub.nowPaymentsPaymentId,
      status:
        paymentStatus === "expired" ? "EXPIRED" :
        paymentStatus === "failed" ? "CANCELED" :
        paymentStatus === "refunded" ? "CANCELED" :
        sub.status, // keep PENDING until finished
    },
  });

  // Activate only on FINAL PAID status
  if (isFinalPaid(paymentStatus)) {
    // Determine plan from orderId first (embedded plan code), then invoice mapping as fallback
    const planCode = planFromOrderId(orderId) || planFromOrderId(sub.nowPaymentsOrderId);
    const planFromCode = planCode ? PLAN_META[planCode] : null;
    const effectiveInvoiceId = invoiceId ?? sub.nowPaymentsInvoiceId;
    const planFromInvoice = effectiveInvoiceId ? IID_TO_PLAN.get(effectiveInvoiceId) : null;
    const plan = planFromCode || planFromInvoice;

    if (!plan) {
      console.warn(
        `[IPN] Unknown plan for orderId=${orderId} invoice=${effectiveInvoiceId}, not granting tier`
      );
      return NextResponse.json({ ok: true, paid_but_unknown_invoice: true });
    }

    const now = new Date();
    // If user already active and expires in future, extend from current expiry
    const base =
      sub.expiresAt && sub.expiresAt.getTime() > now.getTime() ? sub.expiresAt : now;

    const newExpiry = addDays(base, plan.days);

    await db.subscription.update({
      where: { id: sub.id },
      data: {
        tier: plan.tier,
        status: "ACTIVE",
        expiresAt: newExpiry,
      },
    });

    console.log(`[IPN] Activated subscription ${sub.id}: tier=${plan.tier}, expiresAt=${newExpiry.toISOString()}`);
  }

  return NextResponse.json({ ok: true });
}
