/**
 * POST /api/messages/send
 * Send a direct message to another user
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
  const recipientId = body?.recipientId?.trim();
  const subject = body?.subject?.trim();
  const message = body?.message?.trim();

  if (!recipientId || !subject || !message) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  if (subject.length > 200) {
    return NextResponse.json({ ok: false, error: "SUBJECT_TOO_LONG" }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json({ ok: false, error: "MESSAGE_TOO_LONG" }, { status: 400 });
  }

  // Can't message yourself
  if (recipientId === access.user.id) {
    return NextResponse.json({ ok: false, error: "CANNOT_MESSAGE_SELF" }, { status: 400 });
  }

  // Check if recipient exists
  const recipient = await db.user.findUnique({
    where: { id: recipientId },
    select: { id: true },
  });

  if (!recipient) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  // Check if sender is blocked by recipient
  const blocked = await db.userBlock.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId: recipientId,
        blockedId: access.user.id,
      },
    },
  });

  if (blocked) {
    return NextResponse.json({ ok: false, error: "USER_BLOCKED_YOU" }, { status: 403 });
  }

  // Check if sender has blocked recipient (shouldn't be able to message someone you blocked)
  const youBlocked = await db.userBlock.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId: access.user.id,
        blockedId: recipientId,
      },
    },
  });

  if (youBlocked) {
    return NextResponse.json({ ok: false, error: "YOU_BLOCKED_USER" }, { status: 403 });
  }

  // Create the message
  await db.userMessage.create({
    data: {
      userId: recipientId,
      senderId: access.user.id,
      type: "DIRECT",
      subject,
      body: message,
    },
  });

  return NextResponse.json({ ok: true });
}
