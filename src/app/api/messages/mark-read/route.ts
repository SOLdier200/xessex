/**
 * POST /api/messages/mark-read
 * Mark a message as read
 * Body: { messageId: string } or { all: true }
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const { messageId, all } = body;

  if (all) {
    // Mark all unread messages as read
    await db.userMessage.updateMany({
      where: {
        userId: access.user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, markedAll: true });
  }

  if (!messageId) {
    return NextResponse.json({ ok: false, error: "MISSING_MESSAGE_ID" }, { status: 400 });
  }

  // Mark single message as read
  const message = await db.userMessage.findUnique({
    where: { id: messageId },
  });

  if (!message || message.userId !== access.user.id) {
    return NextResponse.json({ ok: false, error: "MESSAGE_NOT_FOUND" }, { status: 404 });
  }

  if (!message.readAt) {
    await db.userMessage.update({
      where: { id: messageId },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, messageId });
}
