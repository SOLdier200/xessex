import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

function makeOrderId() {
  // <= 30 chars, unique per checkout attempt
  return "sx_" + crypto.randomBytes(10).toString("hex"); // 23 chars
}

type Plan = "MM" | "MY" | "DM" | "DY";

const PLAN_TO_IID: Record<Plan, string> = {
  MM: "4346120539",  // Member monthly $3
  MY: "4770954653",  // Member yearly $30
  DM: "6120974427",  // Diamond monthly $18.5
  DY: "4296776562",  // Diamond yearly $185
};

const PLAN_TO_TIER: Record<Plan, "MEMBER" | "DIAMOND"> = {
  MM: "MEMBER",
  MY: "MEMBER",
  DM: "DIAMOND",
  DY: "DIAMOND",
};

const PLAN_TO_DAYS: Record<Plan, number> = {
  MM: 30,
  MY: 365,
  DM: 30,
  DY: 365,
};

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

  if (!plan || !(plan in PLAN_TO_IID)) {
    return NextResponse.json({ ok: false, error: "BAD_PLAN" }, { status: 400 });
  }

  const iid = PLAN_TO_IID[plan];
  const tier = PLAN_TO_TIER[plan];
  const orderId = makeOrderId();

  // Ensure the user has a Subscription row (1:1)
  // Generate unique orderId per checkout attempt for safe IPN correlation
  const sub = await db.subscription.upsert({
    where: { userId: access.user.id },
    create: {
      userId: access.user.id,
      tier,
      status: "PENDING",
      nowPaymentsInvoiceId: iid,
      nowPaymentsOrderId: orderId,
      nowPaymentsPaymentId: null,
      expiresAt: null,
    },
    update: {
      tier,
      status: "PENDING",
      nowPaymentsInvoiceId: iid,
      nowPaymentsOrderId: orderId, // rotate each checkout attempt
      nowPaymentsPaymentId: null,  // clear old payment id
      // don't set expiresAt yet; only set on paid
    },
  });

  // Include order_id in redirect URL for IPN correlation
  const redirectUrl = `https://nowpayments.io/payment/?iid=${iid}&order_id=${encodeURIComponent(orderId)}`;

  return NextResponse.json({
    ok: true,
    redirectUrl,
    plan,
    tier,
    subscriptionId: sub.id,
    // Stablecoin hint for low-cost plans (NOWPayments minimums vary by coin)
    stablecoinHint: plan === "MM"
      ? "Stablecoins (USDT/USDC on TRC20/BSC/Polygon) recommended for low-cost plans."
      : null,
  });
}
