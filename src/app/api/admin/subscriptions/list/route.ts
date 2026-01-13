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
  const status = (sp.get("status") || "").toUpperCase();
  const tier = (sp.get("tier") || "").toUpperCase();
  const q = (sp.get("q") || "").trim();
  const partialOnly = sp.get("partialOnly") === "1";
  const limit = Math.min(Number(sp.get("limit") || 50), 200);
  const cursor = sp.get("cursor") || "";

  const where: Parameters<typeof db.subscription.findMany>[0]["where"] = {};

  if (partialOnly) {
    where.status = "PARTIAL";
  } else if (status && ["ACTIVE", "PENDING", "PARTIAL", "EXPIRED", "CANCELED"].includes(status)) {
    where.status = status as "ACTIVE" | "PENDING" | "PARTIAL" | "EXPIRED" | "CANCELED";
  }

  if (tier && ["MEMBER", "DIAMOND"].includes(tier)) {
    where.tier = tier as "MEMBER" | "DIAMOND";
  }

  if (q) {
    where.OR = [
      { nowPaymentsOrderId: { contains: q, mode: "insensitive" } },
      { nowPaymentsPaymentId: { contains: q, mode: "insensitive" } },
      { nowPaymentsInvoiceId: { contains: q, mode: "insensitive" } },
      { lastTxSig: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const rows = await db.subscription.findMany({
    where,
    include: { user: { select: { id: true, email: true, createdAt: true } } },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

  return NextResponse.json({ ok: true, rows, nextCursor });
}
