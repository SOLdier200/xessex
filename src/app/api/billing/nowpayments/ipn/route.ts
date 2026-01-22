/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

type PlanCode = "M90" | "MY" | "D1" | "D2" | "DY";

// Static invoice mapping (source of truth for tier + duration)
// These are NOWPayments hosted "iid" values
const IID_TO_PLAN = new Map<string, { tier: "MEMBER" | "DIAMOND"; days: number }>([
  // MEMBER
  ["1513416538", { tier: "MEMBER", days: 90 }],   // Member 90 days $10
  ["429715526",  { tier: "MEMBER", days: 365 }],  // Member 1 year $40

  // DIAMOND
  ["355119372", { tier: "DIAMOND", days: 30 }],   // Diamond 1 month $9
  ["949588916",  { tier: "DIAMOND", days: 60 }],  // Diamond 2 months $17
  ["2018295600", { tier: "DIAMOND", days: 365 }], // Diamond 1 year $70
]);

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

function num(x: unknown): number | null {
  const n = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Decide whether to grant access for a "partially_paid" status.
 * Rule: grant if they've paid at least (price_amount * tolerance).
 *
 * - Uses actually_paid_at_fiat if available (best).
 * - Falls back to actually_paid/pay_amount ratio if fiat isn't present.
 */
function partialIsGood(payload: Record<string, unknown>, tolerance = 0.93): boolean {
  const priceAmount = num(payload.price_amount);
  const paidFiat = num(payload.actually_paid_at_fiat);

  if (priceAmount != null && paidFiat != null) {
    return paidFiat >= priceAmount * tolerance;
  }

  const payAmount = num(payload.pay_amount);
  const actuallyPaid = num(payload.actually_paid);

  if (payAmount != null && actuallyPaid != null && payAmount > 0) {
    return actuallyPaid / payAmount >= tolerance;
  }

  return false;
}

/**
 * NOWPayments statuses per docs:
 * waiting, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired
 * We treat sending as paid (confirmed & payout in progress).
 */
function isPaidEnough(status: string): boolean {
  return status === "confirming" || status === "confirmed" || status === "sending" || status === "finished";
}

function isBad(status: string): boolean {
  return status === "expired" || status === "failed" || status === "refunded";
}

/**
 * Extract transaction hash from IPN payload.
 * NOWPayments uses different field names depending on the chain.
 */
function extractTxHash(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.payin_hash,
    payload.payout_hash,
    payload.txid,
    payload.transaction_id,
    payload.hash,
    payload.tx_hash,
  ]
    .map((x) => (x == null ? "" : String(x).trim()))
    .filter(Boolean);

  return candidates[0] || null;
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

  // Log ALL IPN callbacks for debugging (before any validation)
  // This helps debug correlation issues and understand what NOWPayments sends
  let parsedForLog: Record<string, unknown> | null = null;
  try {
    parsedForLog = JSON.parse(raw);
  } catch {
    // Not valid JSON - still log it
  }

  await db.nowPaymentsIpnLog.create({
    data: {
      raw,
      orderId: parsedForLog?.order_id ? String(parsedForLog.order_id) : null,
      paymentId: parsedForLog?.payment_id ? String(parsedForLog.payment_id) : null,
      invoiceId: parsedForLog?.invoice_id ? String(parsedForLog.invoice_id) : null,
      status: parsedForLog?.payment_status ? String(parsedForLog.payment_status) : null,
      amount: parsedForLog?.price_amount ? String(parsedForLog.price_amount) : null,
      currency: parsedForLog?.price_currency ? String(parsedForLog.price_currency) : null,
    },
  }).catch((e) => {
    console.warn("[IPN] Failed to log IPN:", e instanceof Error ? e.message : "unknown");
  });

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

  // NOTE: We intentionally do NOT fall back to invoiceId for correlation.
  // The invoiceId from hosted invoices (iid) is a shared template ID - multiple users
  // share the same iid, which would cause payments to be linked to the wrong user.
  // Only order_id (unique per checkout) and payment_id (unique per payment) are safe.

  // If not found, store in NowPaymentsUnlinked table for manual reconciliation
  if (!sub) {
    console.warn(`[IPN] No subscription found for orderId=${orderId}, paymentId=${paymentId}`);

    // Store unlinked IPN for later reconciliation (if table exists)
    try {
      await db.nowPaymentsUnlinked.create({
        data: {
          nowPaymentsOrderId: orderId,
          nowPaymentsPaymentId: paymentId,
          nowPaymentsInvoiceId: invoiceId,
          paymentStatus,
          payload: payload as object,
        },
      });
      console.log("[IPN] Stored unlinked payment for reconciliation");
    } catch (e) {
      // Table might not exist yet - just log
      console.warn("[IPN] Could not store unlinked payment:", e instanceof Error ? e.message : "unknown");
    }

    return NextResponse.json({ ok: true, unlinked: true });
  }

  // Extract tx hash from payload (chain-dependent field names)
  const txHash = extractTxHash(payload);

  // Store latest provider ids + tx hash for debugging/admin lookup
  // NOTE: We do NOT update nowPaymentsInvoiceId from IPN because hosted invoice iids are
  // shared across users. Only order_id and payment_id are unique and safe to store.
  await db.subscription.update({
    where: { id: sub.id },
    data: {
      nowPaymentsOrderId: orderId ?? sub.nowPaymentsOrderId,
      // Don't overwrite invoiceId from IPN - it might be a shared iid
      nowPaymentsPaymentId: paymentId ?? sub.nowPaymentsPaymentId,
      lastTxSig: txHash ?? sub.lastTxSig,
      // Revoke immediately on bad outcomes (also removes provisional access window)
      ...(isBad(paymentStatus)
        ? { status: paymentStatus === "expired" ? "EXPIRED" : "CANCELED", expiresAt: null }
        : {}),
    },
  });

  // If payment failed/expired/refunded, we've already revoked above
  if (isBad(paymentStatus)) {
    console.log(`[IPN] Revoked subscription ${sub.id}: status=${paymentStatus}`);
    return NextResponse.json({ ok: true, revoked: true });
  }

  // Activate as soon as funds detected (don't wait only for finished)
  // Also handle partially_paid if they've paid at least 93% (fee slippage tolerance)
  const shouldGrant =
    isPaidEnough(paymentStatus) ||
    (paymentStatus === "partially_paid" && partialIsGood(payload, 0.93));

  if (shouldGrant) {
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
    // Only extend from existing expiry if already ACTIVE (not provisional PENDING)
    // This prevents giving "bonus time" from the provisional window
    const base =
      sub.status === "ACTIVE" && sub.expiresAt && sub.expiresAt.getTime() > now.getTime()
        ? sub.expiresAt
        : now;

    const newExpiry = addDays(base, plan.days);

    await db.subscription.update({
      where: { id: sub.id },
      data: {
        tier: plan.tier,
        status: "ACTIVE",
        expiresAt: newExpiry,
      },
    });

    console.log(
      `[IPN] Activated subscription ${sub.id}: tier=${plan.tier}, expiresAt=${newExpiry.toISOString()}, status=${paymentStatus}`
    );

    return NextResponse.json({ ok: true, activated: true });
  }

  // Underpaid partial — record as PARTIAL but do NOT grant access
  if (paymentStatus === "partially_paid") {
    await db.subscription.update({
      where: { id: sub.id },
      data: { status: "PARTIAL" },
    });
    console.warn(`[IPN] Partial underpayment for ${sub.id}, awaiting completion`);
    return NextResponse.json({ ok: true, partial: true });
  }

  return NextResponse.json({ ok: true });
}
