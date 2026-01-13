import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

const PLAN_BY_CODE: Record<string, { tier: "MEMBER" | "DIAMOND"; days: number }> = {
  M60: { tier: "MEMBER", days: 60 },
  MY: { tier: "MEMBER", days: 365 },
  D1: { tier: "DIAMOND", days: 30 },
  D2: { tier: "DIAMOND", days: 60 },
  DY: { tier: "DIAMOND", days: 365 },
};

function planFromOrderId(orderId: string | null) {
  if (!orderId) return null;
  const m = orderId.match(/^sx_(M60|MY|D1|D2|DY)_/i);
  return m ? m[1].toUpperCase() : null;
}

function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function POST(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    subscriptionId?: string;
    orderId?: string;
    daysOverride?: number;
    setTier?: "MEMBER" | "DIAMOND";
  } | null;

  const subscriptionId = body?.subscriptionId || null;
  const orderId = body?.orderId || null;

  if (!subscriptionId && !orderId) {
    return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
  }

  const sub = subscriptionId
    ? await db.subscription.findUnique({ where: { id: subscriptionId } })
    : await db.subscription.findUnique({ where: { nowPaymentsOrderId: orderId! } });

  if (!sub) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const code = planFromOrderId(sub.nowPaymentsOrderId || "");
  const plan = code ? PLAN_BY_CODE[code] : null;

  const days = typeof body?.daysOverride === "number" ? body.daysOverride : plan?.days ?? 60;
  const tier = body?.setTier ?? plan?.tier ?? sub.tier;

  const now = new Date();
  const base = sub.expiresAt && sub.expiresAt > now ? sub.expiresAt : now;
  const newExpiry = addDays(base, days);

  const updated = await db.subscription.update({
    where: { id: sub.id },
    data: { tier, status: "ACTIVE", expiresAt: newExpiry },
  });

  console.log(`[Admin] Activated subscription ${updated.id} by ${access.user?.email || access.user?.solWallet}`);

  return NextResponse.json({
    ok: true,
    subscriptionId: updated.id,
    activated: true,
    tier: updated.tier,
    expiresAt: updated.expiresAt?.toISOString() ?? null,
    daysGranted: days,
  });
}
