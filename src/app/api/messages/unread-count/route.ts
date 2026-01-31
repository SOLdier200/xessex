/**
 * GET /api/messages/unread-count
 * Returns count of unread messages for the current user
 */

import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, count: 0 });
  }

  const count = await db.userMessage.count({
    where: {
      userId: access.user.id,
      readAt: null,
    },
  });

  return NextResponse.json({ ok: true, count });
}
