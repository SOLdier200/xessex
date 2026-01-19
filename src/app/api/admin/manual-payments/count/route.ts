/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = await getAccessContext();
  if (!ctx.isAdminOrMod) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "PENDING") as "PENDING" | "APPROVED" | "DENIED" | "EXPIRED";

  const count = await db.manualPayment.count({ where: { status } });
  return NextResponse.json({ ok: true, count });
}
