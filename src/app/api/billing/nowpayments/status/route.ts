import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const orderId = req.nextUrl.searchParams.get("order_id") || "";
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "MISSING_ORDER_ID" }, { status: 400 });
  }

  const sub = await db.subscription.findFirst({
    where: { userId: access.user.id, nowPaymentsOrderId: orderId },
    select: {
      status: true,
      tier: true,
      expiresAt: true,
      nowPaymentsInvoiceId: true,
      nowPaymentsPaymentId: true,
    },
  });

  if (!sub) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...sub });
}
