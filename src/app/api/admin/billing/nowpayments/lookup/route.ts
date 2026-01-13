import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const orderId = (sp.get("order_id") || "").trim();
  const tx = (sp.get("tx") || "").trim();
  const paymentId = (sp.get("payment_id") || "").trim();
  const invoiceId = (sp.get("invoice_id") || "").trim();

  if (!orderId && !tx && !paymentId && !invoiceId) {
    return NextResponse.json({ ok: false, error: "MISSING_QUERY" }, { status: 400 });
  }

  const orConditions = [
    orderId ? { nowPaymentsOrderId: orderId } : null,
    tx ? { lastTxSig: tx } : null,
    paymentId ? { nowPaymentsPaymentId: paymentId } : null,
    invoiceId ? { nowPaymentsInvoiceId: invoiceId } : null,
  ].filter(Boolean) as { [key: string]: string }[];

  const sub = await db.subscription.findFirst({
    where: { OR: orConditions },
    include: { user: { select: { id: true, email: true, createdAt: true } } },
  });

  if (!sub) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    subscription: {
      id: sub.id,
      userId: sub.userId,
      tier: sub.tier,
      status: sub.status,
      expiresAt: sub.expiresAt?.toISOString() ?? null,
      nowPaymentsOrderId: sub.nowPaymentsOrderId,
      nowPaymentsInvoiceId: sub.nowPaymentsInvoiceId,
      nowPaymentsPaymentId: sub.nowPaymentsPaymentId,
      txHash: sub.lastTxSig,
      updatedAt: sub.updatedAt.toISOString(),
      createdAt: sub.createdAt.toISOString(),
    },
    user: sub.user,
  });
}
