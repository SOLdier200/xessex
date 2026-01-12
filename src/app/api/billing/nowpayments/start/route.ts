import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

type Plan = "MM" | "MY" | "DM" | "DY";

const NOWPAYMENTS_API_BASE = "https://api.nowpayments.io/v1";

const PLAN_META: Record<
  Plan,
  {
    iid: string;
    tier: "MEMBER" | "DIAMOND";
    days: number;
    price: number;
    description: string;
  }
> = {
  MM: {
    iid: "4346120539",
    tier: "MEMBER",
    days: 30,
    price: 3,
    description: "Member monthly",
  },
  MY: {
    iid: "4770954653",
    tier: "MEMBER",
    days: 365,
    price: 30,
    description: "Member yearly",
  },
  DM: {
    iid: "6120974427",
    tier: "DIAMOND",
    days: 30,
    price: 18.5,
    description: "Diamond monthly",
  },
  DY: {
    iid: "4296776562",
    tier: "DIAMOND",
    days: 365,
    price: 185,
    description: "Diamond yearly",
  },
};

function makeOrderId(plan: Plan) {
  // <= 30 chars, unique per checkout attempt
  return `sx_${plan}_` + crypto.randomBytes(8).toString("hex"); // 22 chars
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

type InvoiceResult = {
  invoiceUrl: string;
  invoiceId: string | null;
};

async function createNowPaymentsInvoice(options: {
  apiKey: string;
  baseUrl: string;
  orderId: string;
  price: number;
  description: string;
  preferStablecoin?: boolean;
}): Promise<InvoiceResult | null> {
  const basePayload = {
    price_amount: options.price,
    price_currency: "usd",
    order_id: options.orderId,
    order_description: options.description,
    ipn_callback_url: `${options.baseUrl}/api/billing/nowpayments/ipn`,
    success_url: `${options.baseUrl}/signup?waiting=1`,
    cancel_url: `${options.baseUrl}/signup`,
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

  const payload = { ...basePayload };
  if (options.preferStablecoin) {
    payload.pay_currency = "USDTTRC20";
  }

  let result = await send(payload);

  if (!result.res.ok && options.preferStablecoin) {
    result = await send(basePayload);
  }

  if (!result.res.ok) {
    console.error("[NOWPayments] Invoice create failed", {
      status: result.res.status,
      body: result.data,
    });
    return null;
  }

  const invoiceUrl =
    (result.data?.invoice_url as string | undefined) ||
    (result.data?.invoiceUrl as string | undefined) ||
    null;

  if (!invoiceUrl) {
    console.error("[NOWPayments] Missing invoice_url", result.data);
    return null;
  }

  const invoiceId =
    (result.data?.invoice_id as string | undefined) ||
    (result.data?.id as string | undefined) ||
    null;

  if (!invoiceId) {
    try {
      const parsed = new URL(invoiceUrl);
      const fromUrl = parsed.searchParams.get("iid") || parsed.searchParams.get("invoice_id");
      if (fromUrl) {
        return { invoiceUrl, invoiceId: fromUrl };
      }
    } catch {
      // ignore parsing failures
    }
  }

  return { invoiceUrl, invoiceId };
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
  const tier = meta.tier;
  const orderId = makeOrderId(plan);
  const baseUrl = resolveBaseUrl(req);

  // Provisional access window (instant access while payment confirms)
  const now = new Date();
  const provisionalExpiresAt = addMinutes(now, 45);

  // Ensure the user has a Subscription row (1:1)
  // Generate unique orderId per checkout attempt for safe IPN correlation
  const sub = await db.subscription.upsert({
    where: { userId: access.user.id },
    create: {
      userId: access.user.id,
      tier,
      status: "PENDING",
      nowPaymentsInvoiceId: null,
      nowPaymentsOrderId: orderId,
      nowPaymentsPaymentId: null,
      expiresAt: provisionalExpiresAt, // instant access window
    },
    update: {
      tier,
      status: "PENDING",
      nowPaymentsInvoiceId: null,
      nowPaymentsOrderId: orderId, // rotate each checkout attempt
      nowPaymentsPaymentId: null,  // clear old payment id
      expiresAt: provisionalExpiresAt, // refresh provisional each checkout attempt
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
      preferStablecoin: plan === "MM",
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
      tier,
      subscriptionId: sub.id,
      provisionalUntil: provisionalExpiresAt.toISOString(),
      stablecoinHint:
        plan === "MM"
          ? "Stablecoins (USDT/USDC on TRC20/BSC/Polygon) recommended for low-cost plans."
          : null,
    });
  }

  // Fallback to hosted invoice link if API creation fails
  const fallbackUrl = `https://nowpayments.io/payment/?iid=${meta.iid}&order_id=${encodeURIComponent(orderId)}`;

  await db.subscription.update({
    where: { id: sub.id },
    data: { nowPaymentsInvoiceId: meta.iid },
  });

  return NextResponse.json({
    ok: true,
    redirectUrl: fallbackUrl,
    plan,
    tier,
    subscriptionId: sub.id,
    provisionalUntil: provisionalExpiresAt.toISOString(),
    // Stablecoin hint for low-cost plans (NOWPayments minimums vary by coin)
    stablecoinHint: plan === "MM"
      ? "Stablecoins (USDT/USDC on TRC20/BSC/Polygon) recommended for low-cost plans."
      : null,
  });
}
