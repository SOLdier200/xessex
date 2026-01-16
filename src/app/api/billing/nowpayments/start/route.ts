import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

type Plan = "M90" | "MY" | "D1" | "D2" | "DY";

const NOWPAYMENTS_API_BASE = "https://api.nowpayments.io/v1";

const PLAN_META: Record<
  Plan,
  {
    iid: string;
    tier: "MEMBER" | "DIAMOND";
    days: number;
    price: number;
    description: string;
    preferLowMinCoins?: boolean;
  }
> = {
  M90: {
    iid: "1513416538",
    tier: "MEMBER",
    days: 90,
    price: 10,
    description: "Member 90 days",
  },
  MY: {
    iid: "429715526",
    tier: "MEMBER",
    days: 365,
    price: 40,
    description: "Member yearly",
  },
  D1: {
    iid: "1754587706",
    tier: "DIAMOND",
    days: 30,
    price: 18,
    description: "Diamond 1 month",
  },
  D2: {
    iid: "552457287",
    tier: "DIAMOND",
    days: 60,
    price: 30,
    description: "Diamond 2 months",
  },
  DY: {
    iid: "1689634405",
    tier: "DIAMOND",
    days: 365,
    price: 100,
    description: "Diamond yearly",
  },
};

function makeOrderId(plan: Plan) {
  return `sx_${plan}_` + crypto.randomBytes(8).toString("hex");
}

function addMinutes(from: Date, minutes: number) {
  return new Date(from.getTime() + minutes * 60 * 1000);
}

function resolveBaseUrl(req: NextRequest) {
  const envBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL;

  if (envBase) return envBase.replace(/\/+$/, "");

  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const host = forwardedHost || req.headers.get("host");
  const proto = forwardedProto || req.nextUrl.protocol.replace(":", "");

  if (host) return `${proto}://${host}`;
  return req.nextUrl.origin;
}

type InvoiceResult = { invoiceUrl: string; invoiceId: string | null };

async function createNowPaymentsInvoice(options: {
  apiKey: string;
  baseUrl: string;
  orderId: string;
  price: number;
  description: string;
  preferLowMinCoins?: boolean;
}): Promise<InvoiceResult | null> {
  // Put order_id into redirect URLs so the pages can display status
  const successUrl = `${options.baseUrl}/billing/nowpayments/success?order_id=${encodeURIComponent(
    options.orderId
  )}`;
  const cancelUrl = `${options.baseUrl}/billing/nowpayments/failed?order_id=${encodeURIComponent(
    options.orderId
  )}`;
  const partialUrl = `${options.baseUrl}/billing/nowpayments/partial?order_id=${encodeURIComponent(
    options.orderId
  )}`;

  const basePayload = {
    price_amount: options.price,
    price_currency: "usd",
    order_id: options.orderId,
    order_description: options.description,
    ipn_callback_url: `${options.baseUrl}/api/billing/nowpayments/ipn`,
    success_url: successUrl,
    cancel_url: cancelUrl,
    partially_paid_url: partialUrl,
  } as Record<string, unknown>;

  async function send(payload: Record<string, unknown>) {
    const res = await fetch(`${NOWPAYMENTS_API_BASE}/invoice`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": options.apiKey,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    return { res, data };
  }

  const candidates = options.preferLowMinCoins
    ? ["usdttrc20", "trx", "xlm", "xrp", "ltc", "bnbmainnet"]
    : [null];

  let last: { res: Response; data: unknown } | null = null;

  for (const coin of candidates) {
    const attemptPayload = { ...basePayload } as Record<string, unknown>;
    if (coin) attemptPayload.pay_currency = coin;

    const attempt = await send(attemptPayload);
    last = attempt;

    if (attempt.res.ok) {
      const invoiceUrl =
        (attempt.data as Record<string, unknown>)?.invoice_url as string | undefined ||
        (attempt.data as Record<string, unknown>)?.invoiceUrl as string | undefined ||
        null;

      if (!invoiceUrl) {
        console.error("[NOWPayments] Missing invoice_url", attempt.data);
        return null;
      }

      let invoiceId =
        (attempt.data as Record<string, unknown>)?.invoice_id as string | undefined ||
        (attempt.data as Record<string, unknown>)?.id as string | undefined ||
        null;

      if (!invoiceId) {
        try {
          const parsed = new URL(invoiceUrl);
          const fromUrl = parsed.searchParams.get("iid") || parsed.searchParams.get("invoice_id");
          if (fromUrl) invoiceId = fromUrl;
        } catch {
          // ignore parsing failures
        }
      }

      console.log(`[NOWPayments] Invoice created with pay_currency=${coin || "user-choice"}`);
      return { invoiceUrl, invoiceId };
    }

    const msg = JSON.stringify(attempt.data || {});
    const isMinErr =
      msg.toLowerCase().includes("less than minimal") ||
      msg.toLowerCase().includes("minimum");

    console.warn("[NOWPayments] Invoice create failed", {
      pay_currency: coin,
      status: attempt.res.status,
      body: attempt.data,
    });

    if (!isMinErr) break;
  }

  console.error("[NOWPayments] Invoice create failed (all attempts)", {
    status: last?.res.status,
    body: last?.data,
  });

  return null;
}

/**
 * POST /api/billing/nowpayments/start
 * Ties the clicked plan button to the logged-in user before redirecting to NOWPayments.
 * This creates/updates a PENDING subscription so the IPN webhook can correlate it.
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { plan?: Plan } | null;
  const plan = body?.plan;

  if (!plan || !(plan in PLAN_META)) {
    return NextResponse.json({ ok: false, error: "BAD_PLAN" }, { status: 400 });
  }

  const meta = PLAN_META[plan];
  const orderId = makeOrderId(plan);
  const baseUrl = resolveBaseUrl(req);

  const now = new Date();
  const provisionalExpiresAt = addMinutes(now, 45);

  const sub = await db.subscription.upsert({
    where: { userId: access.user.id },
    create: {
      userId: access.user.id,
      tier: meta.tier,
      status: "PENDING",
      nowPaymentsInvoiceId: null,
      nowPaymentsOrderId: orderId,
      nowPaymentsPaymentId: null,
      expiresAt: provisionalExpiresAt,
    },
    update: {
      tier: meta.tier,
      status: "PENDING",
      nowPaymentsInvoiceId: null,
      nowPaymentsOrderId: orderId,
      nowPaymentsPaymentId: null,
      expiresAt: provisionalExpiresAt,
    },
  });

  let redirectUrl: string | null = null;
  let invoiceId: string | null = null;

  const apiKey = process.env.NOWPAYMENTS_API_KEY || "";
  if (apiKey) {
    const invoice = await createNowPaymentsInvoice({
      apiKey,
      baseUrl,
      orderId,
      price: meta.price,
      description: meta.description,
      preferLowMinCoins: !!meta.preferLowMinCoins,
    });

    if (invoice?.invoiceUrl) {
      redirectUrl = invoice.invoiceUrl;
      invoiceId = invoice.invoiceId;
    }
  } else {
    console.warn("[NOWPayments] Missing NOWPAYMENTS_API_KEY, using hosted invoice");
  }

  if (redirectUrl) {
    if (invoiceId) {
      await db.subscription.update({
        where: { id: sub.id },
        data: { nowPaymentsInvoiceId: invoiceId },
      });
    }

    return NextResponse.json({
      ok: true,
      redirectUrl,
      plan,
      tier: meta.tier,
      subscriptionId: sub.id,
      provisionalUntil: provisionalExpiresAt.toISOString(),
    });
  }

  // Fallback to hosted invoice link using iid
  const fallbackUrl = `https://nowpayments.io/payment/?iid=${meta.iid}&order_id=${encodeURIComponent(orderId)}`;

  await db.subscription.update({
    where: { id: sub.id },
    data: { nowPaymentsInvoiceId: meta.iid },
  });

  return NextResponse.json({
    ok: true,
    redirectUrl: fallbackUrl,
    plan,
    tier: meta.tier,
    subscriptionId: sub.id,
    provisionalUntil: provisionalExpiresAt.toISOString(),
  });
}
