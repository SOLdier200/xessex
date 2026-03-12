/**
 * POST /api/admin/notify-tos-update
 * Sends a system message to ALL users notifying them that the TOS has been updated.
 * Admin only. One-time use endpoint.
 */

import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST() {
  const access = await getAccessContext();

  if (!access.user || access.user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const allUsers = await db.user.findMany({
    select: { id: true },
  });

  const subject = "Terms of Service Updated";
  const body =
    "Our Terms of Service have been updated as of February 2026. " +
    "Please review the updated Terms at https://xessex.me/terms to stay informed about your rights and obligations on the platform. " +
    "Continued use of Xessex constitutes acceptance of the updated Terms.";

  const batchSize = 100;
  let created = 0;

  for (let i = 0; i < allUsers.length; i += batchSize) {
    const batch = allUsers.slice(i, i + batchSize);
    await db.userMessage.createMany({
      data: batch.map((u) => ({
        userId: u.id,
        senderId: null,
        type: "SYSTEM",
        subject,
        body,
      })),
    });
    created += batch.length;
  }

  console.log(`[notify-tos-update] Sent TOS update notification to ${created} users`);

  return NextResponse.json({
    ok: true,
    recipientCount: created,
  });
}
