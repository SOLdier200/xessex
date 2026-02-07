/**
 * POST /api/messages/delete
 * Delete a message from user's inbox
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

  const body = await req.json().catch(() => null);

  // Delete all messages for this user
  if (body?.all === true) {
    const result = await db.userMessage.deleteMany({
      where: { userId: access.user.id },
    });
    return NextResponse.json({ ok: true, deleted: result.count });
  }

  const messageId = body?.messageId?.trim();

  if (!messageId) {
    return NextResponse.json({ ok: false, error: "MISSING_MESSAGE_ID" }, { status: 400 });
  }

  // Find the message and verify ownership
  const message = await db.userMessage.findUnique({
    where: { id: messageId },
    select: { id: true, userId: true },
  });

  if (!message) {
    return NextResponse.json({ ok: false, error: "MESSAGE_NOT_FOUND" }, { status: 404 });
  }

  // Only the recipient can delete messages from their inbox
  if (message.userId !== access.user.id) {
    return NextResponse.json({ ok: false, error: "NOT_YOUR_MESSAGE" }, { status: 403 });
  }

  // Delete the message
  await db.userMessage.delete({
    where: { id: messageId },
  });

  return NextResponse.json({ ok: true });
}
