import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 50), 200);

  // Query PARTIAL subscriptions directly via Prisma (no SQL view needed)
  const rows = await db.subscription.findMany({
    where: { status: "PARTIAL" },
    include: { user: { select: { id: true, email: true, createdAt: true } } },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ ok: true, rows });
}
