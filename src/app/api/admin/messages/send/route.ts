/**
 * POST /api/admin/messages/send
 * Send a message to one or all users
 * Body: {
 *   targetUserId?: string,  // For single user message (required for mods)
 *   mass?: boolean,         // Send to all users (admin only)
 *   subject: string,
 *   body: string
 * }
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

  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const { targetUserId, mass, subject, body: messageBody } = body;

  if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "MISSING_SUBJECT" }, { status: 400 });
  }

  if (!messageBody || typeof messageBody !== "string" || messageBody.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "MISSING_BODY" }, { status: 400 });
  }

  const isAdmin = access.user.role === "ADMIN";

  // Mods can only send to single users
  if (!isAdmin && mass) {
    return NextResponse.json(
      { ok: false, error: "MASS_MESSAGE_ADMIN_ONLY" },
      { status: 403 }
    );
  }

  // Must have either targetUserId or mass=true
  if (!targetUserId && !mass) {
    return NextResponse.json(
      { ok: false, error: "MUST_SPECIFY_TARGET_OR_MASS" },
      { status: 400 }
    );
  }

  try {
    if (mass && isAdmin) {
      // Mass message to all users
      const allUsers = await db.user.findMany({
        select: { id: true },
      });

      // Create messages in batches
      const batchSize = 100;
      let created = 0;

      for (let i = 0; i < allUsers.length; i += batchSize) {
        const batch = allUsers.slice(i, i + batchSize);
        await db.userMessage.createMany({
          data: batch.map((u) => ({
            userId: u.id,
            senderId: access.user!.id,
            type: "MASS",
            subject: subject.trim(),
            body: messageBody.trim(),
          })),
        });
        created += batch.length;
      }

      console.log(`[admin/messages/send] ${access.user.id} sent mass message to ${created} users`);

      return NextResponse.json({
        ok: true,
        type: "MASS",
        recipientCount: created,
      });
    } else {
      // Single user message
      const targetUser = await db.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser) {
        return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
      }

      await db.userMessage.create({
        data: {
          userId: targetUserId,
          senderId: access.user.id,
          type: "DIRECT",
          subject: subject.trim(),
          body: messageBody.trim(),
        },
      });

      console.log(`[admin/messages/send] ${access.user.id} sent message to ${targetUserId}`);

      return NextResponse.json({
        ok: true,
        type: "DIRECT",
        recipientId: targetUserId,
      });
    }
  } catch (err) {
    console.error("[admin/messages/send] Error:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
