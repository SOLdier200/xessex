/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAccessContext();
  if (!ctx.isAdminOrMod) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() : "";

  const mp = await db.manualPayment.findUnique({ where: { id } });
  if (!mp) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (mp.status !== "PENDING") return NextResponse.json({ error: "not_pending" }, { status: 400 });

  await db.$transaction(async (tx) => {
    await tx.manualPayment.update({
      where: { id: mp.id },
      data: {
        status: "DENIED",
        reviewedAt: new Date(),
        reviewedBy: ctx.user?.id || undefined,
        adminNote: adminNote || undefined,
      },
    });

    // Revoke provisional immediately if they were in PARTIAL
    await tx.subscription.updateMany({
      where: { userId: mp.userId, status: "PARTIAL" },
      data: { status: "EXPIRED", expiresAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true });
}
