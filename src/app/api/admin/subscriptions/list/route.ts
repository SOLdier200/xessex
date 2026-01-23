import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

// ----------------- PLAN CATALOG -----------------
type NowPlanCode = "M90" | "MY" | "D1" | "D2" | "DY";

const NOW_PLAN_USD_CENTS: Record<NowPlanCode, number> = {
  M90: 1000, // $10
  MY:  4000, // $40
  D1:   900, // $9
  D2:  3000, // $30
  DY:  7000, // $70
};

function nowPlanFromOrderId(orderId?: string | null): NowPlanCode | null {
  if (!orderId) return null;
  const m = orderId.match(/^sx_(M90|MY|D1|D2|DY)_/i);
  return (m?.[1]?.toUpperCase() as NowPlanCode) || null;
}

// Manual planCode → expected USD cents
function expectedUsdCentsForManual(planCode: string | null | undefined): number | null {
  if (!planCode) return null;
  switch (planCode) {
    case "member_monthly": return 400;   // $4
    case "member_yearly":  return 4000;  // $40
    case "diamond_monthly": return 900;  // $9
    case "diamond_yearly":  return 7000; // $70
    default: return null;
  }
}

function paidUsdCentsFromIpn(amount: string | null, currency: string | null): number | null {
  if (!amount || !currency) return null;
  const cur = String(currency).toUpperCase();
  if (cur !== "USD") return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

// ----------------- ROUTE -----------------
export async function GET(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const status = (sp.get("status") || "").toUpperCase();
  const tier = (sp.get("tier") || "").toUpperCase();
  const paymentMethod = (sp.get("paymentMethod") || "").toUpperCase();
  const q = (sp.get("q") || "").trim();
  const partialOnly = sp.get("partialOnly") === "1";
  const limit = Math.min(Number(sp.get("limit") || 50), 200);
  const cursor = sp.get("cursor") || "";

  const where: Prisma.SubscriptionWhereInput = {};

  if (partialOnly) {
    where.status = "PARTIAL";
  } else if (status && ["ACTIVE", "PENDING", "PARTIAL", "EXPIRED", "CANCELED"].includes(status)) {
    where.status = status as "ACTIVE" | "PENDING" | "PARTIAL" | "EXPIRED" | "CANCELED";
  }

  if (tier && ["MEMBER", "DIAMOND"].includes(tier)) {
    where.tier = tier as "MEMBER" | "DIAMOND";
  }

  if (paymentMethod && ["CRYPTO", "CARD", "CASHAPP"].includes(paymentMethod)) {
    where.paymentMethod = paymentMethod as "CRYPTO" | "CARD" | "CASHAPP";
  }

  if (q) {
    where.OR = [
      { nowPaymentsOrderId: { contains: q, mode: "insensitive" } },
      { nowPaymentsPaymentId: { contains: q, mode: "insensitive" } },
      { nowPaymentsInvoiceId: { contains: q, mode: "insensitive" } },
      { lastTxSig: { contains: q, mode: "insensitive" } },
      { manualPaymentId: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  // ---- Fetch page rows ----
  const rows = await db.subscription.findMany({
    where,
    include: { user: { select: { id: true, email: true, createdAt: true } } },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  // ---- Join ManualPayment ----
  const manualPaymentIds = rows
    .filter((r) => r.paymentMethod === "CASHAPP" && r.manualPaymentId)
    .map((r) => r.manualPaymentId as string);

  const manualPayments = manualPaymentIds.length
    ? await db.manualPayment.findMany({
        where: { id: { in: manualPaymentIds } },
        select: { id: true, verifyCode: true, amountUsd: true, planCode: true },
      })
    : [];

  const manualPaymentMap = new Map(manualPayments.map((mp) => [mp.id, mp]));

  // ---- Latest IPN per orderId (safe: query all, then pick first per orderId) ----
  const cryptoOrderIds = rows
    .filter((r) => r.paymentMethod === "CRYPTO" && r.nowPaymentsOrderId)
    .map((r) => r.nowPaymentsOrderId as string);

  const ipnLogs = cryptoOrderIds.length
    ? await db.nowPaymentsIpnLog.findMany({
        where: { orderId: { in: cryptoOrderIds } },
        orderBy: { createdAt: "desc" },
        select: { orderId: true, amount: true, currency: true, status: true, createdAt: true },
      })
    : [];

  const ipnLogMap = new Map<string, { amount: string | null; currency: string | null; status: string | null }>();
  for (const log of ipnLogs) {
    if (!log.orderId) continue;
    if (!ipnLogMap.has(log.orderId)) {
      ipnLogMap.set(log.orderId, { amount: log.amount, currency: log.currency, status: log.status });
    }
  }

  // ---- Enrich page rows ----
  const enrichedRows = rows.map((r) => {
    const mp = r.manualPaymentId ? manualPaymentMap.get(r.manualPaymentId) : null;
    const ipn = r.nowPaymentsOrderId ? ipnLogMap.get(r.nowPaymentsOrderId) : null;

    // Expected USD cents (plan catalog)
    let expectedUsdCents: number | null = null;

    if (r.paymentMethod === "CASHAPP") {
      expectedUsdCents = expectedUsdCentsForManual(mp?.planCode ?? null);
    } else {
      const plan = nowPlanFromOrderId(r.nowPaymentsOrderId);
      expectedUsdCents = plan ? NOW_PLAN_USD_CENTS[plan] ?? null : null;
    }

    // Paid display (provider)
    let paidDisplay = "—";
    if (r.paymentMethod === "CASHAPP" && mp?.amountUsd != null) {
      paidDisplay = `$${(mp.amountUsd / 100).toFixed(2)}`;
    } else if (r.paymentMethod === "CRYPTO" && ipn?.amount && ipn?.currency) {
      const cur = String(ipn.currency).toUpperCase();
      if (cur === "USD") {
        const n = Number(ipn.amount);
        paidDisplay = Number.isFinite(n) ? `$${n.toFixed(2)}` : `${ipn.amount} ${cur}`;
      } else {
        paidDisplay = `${ipn.amount} ${cur}`;
      }
    }

    return {
      ...r,
      verifyCode: mp?.verifyCode || null,
      expectedUsdCents,
      paidDisplay,
    };
  });

  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

  // ----------------- GRAND TOTALS (for current filter) -----------------
  // Total count for the filter
  const totalCountPromise = db.subscription.count({ where });

  // Fetch all matching subs (minimal fields) for totals computation
  const allMatchingForTotalsPromise = db.subscription.findMany({
    where,
    select: {
      paymentMethod: true,
      nowPaymentsOrderId: true,
      manualPaymentId: true,
    },
  });

  const [countAll, allMatching] = await Promise.all([totalCountPromise, allMatchingForTotalsPromise]);

  // Manual totals need manualPayment.planCode + amountUsd, so gather ids
  const allManualIds = allMatching
    .filter((s) => s.paymentMethod === "CASHAPP" && s.manualPaymentId)
    .map((s) => s.manualPaymentId as string);

  const allManualPayments = allManualIds.length
    ? await db.manualPayment.findMany({
        where: { id: { in: allManualIds } },
        select: { id: true, planCode: true, amountUsd: true },
      })
    : [];

  const allManualMap = new Map(allManualPayments.map((m) => [m.id, m]));

  // For paid USD totals from NOWPayments: use latest IPN logs (USD only) per orderId
  const allCryptoOrderIds = allMatching
    .filter((s) => s.paymentMethod === "CRYPTO" && s.nowPaymentsOrderId)
    .map((s) => s.nowPaymentsOrderId as string);

  const allIpnLogs = allCryptoOrderIds.length
    ? await db.nowPaymentsIpnLog.findMany({
        where: { orderId: { in: allCryptoOrderIds } },
        orderBy: { createdAt: "desc" },
        select: { orderId: true, amount: true, currency: true, createdAt: true },
      })
    : [];

  const allLatestIpn = new Map<string, { amount: string | null; currency: string | null }>();
  for (const l of allIpnLogs) {
    if (!l.orderId) continue;
    if (!allLatestIpn.has(l.orderId)) allLatestIpn.set(l.orderId, { amount: l.amount, currency: l.currency });
  }

  let expectedAll = 0;
  let paidUsdAll = 0;
  let paidUsdCount = 0;
  let paidNonUsdCount = 0;

  for (const s of allMatching) {
    if (s.paymentMethod === "CASHAPP") {
      const mp = s.manualPaymentId ? allManualMap.get(s.manualPaymentId) : null;
      const expected = expectedUsdCentsForManual(mp?.planCode ?? null);
      if (expected != null) expectedAll += expected;

      if (mp?.amountUsd != null) {
        paidUsdAll += mp.amountUsd;
        paidUsdCount += 1;
      }
      continue;
    }

    // CRYPTO / CARD use orderId plan code for expected
    const plan = nowPlanFromOrderId(s.nowPaymentsOrderId);
    const expected = plan ? NOW_PLAN_USD_CENTS[plan] ?? null : null;
    if (expected != null) expectedAll += expected;

    if (s.paymentMethod === "CRYPTO" && s.nowPaymentsOrderId) {
      const ipn = allLatestIpn.get(s.nowPaymentsOrderId) ?? null;
      const paidCents = paidUsdCentsFromIpn(ipn?.amount ?? null, ipn?.currency ?? null);
      if (paidCents != null) {
        paidUsdAll += paidCents;
        paidUsdCount += 1;
      } else if (ipn?.amount && ipn?.currency) {
        paidNonUsdCount += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    rows: enrichedRows,
    nextCursor,
    totalsAll: {
      count: countAll,
      expectedUsdCents: expectedAll,
      paidUsdCents: paidUsdAll,
      paidUsdCount,
      paidNonUsdCount,
    },
  });
}
