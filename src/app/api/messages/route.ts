/**
 * GET /api/messages
 * Returns current user's messages
 */

import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const messages = await db.userMessage.findMany({
    where: { userId: access.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      sender: {
        select: { id: true, email: true, walletAddress: true, solWallet: true, role: true },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    messages: messages.map((m) => ({
      id: m.id,
      type: m.type,
      subject: m.subject,
      body: m.body,
      read: !!m.readAt,
      createdAt: m.createdAt.toISOString(),
      senderId: m.senderId,
      sender: m.sender
        ? {
            id: m.sender.id,
            display: m.sender.email || m.sender.solWallet || m.sender.walletAddress,
            role: m.sender.role,
          }
        : null,
    })),
  });
}
