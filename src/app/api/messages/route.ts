/**
 * GET /api/messages
 * Returns current user's messages
 */

import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

// Extract winner ID from message body if present
function extractWinnerId(body: string): string | null {
  const match = body.match(/\[WINNER_ID:([^\]]+)\]/);
  return match ? match[1] : null;
}

// Check if message contains avatar prompt
function hasAvatarPrompt(body: string): boolean {
  return body.includes("[AVATAR_PROMPT]");
}

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
        select: { id: true, email: true, walletAddress: true, role: true },
      },
    },
  });

  // Get all pending raffle wins for this user to check claim status
  const pendingWins = await db.raffleWinner.findMany({
    where: {
      userId: access.user.id,
      status: "PENDING",
    },
    select: { id: true },
  });
  const pendingWinIds = new Set(pendingWins.map((w) => w.id));

  // Check if any message has avatar prompt and if user needs avatar
  const hasAnyAvatarPrompt = messages.some((m) => hasAvatarPrompt(m.body));
  let userNeedsAvatar = false;
  if (hasAnyAvatarPrompt) {
    const user = await db.user.findUnique({
      where: { id: access.user.id },
      select: { profilePictureKey: true },
    });
    userNeedsAvatar = !user?.profilePictureKey;
  }

  return NextResponse.json({
    ok: true,
    messages: messages.map((m) => {
      const winnerId = extractWinnerId(m.body);
      // Check if this message has a winner that's still claimable
      const canClaim = winnerId ? pendingWinIds.has(winnerId) : false;

      // Check if this message has avatar prompt
      const isAvatarPrompt = hasAvatarPrompt(m.body);

      return {
        id: m.id,
        type: m.type,
        subject: m.subject,
        body: m.body
          .replace(/\[WINNER_ID:[^\]]+\]/, "")
          .replace(/\[AVATAR_PROMPT\]/, "")
          .trim(), // Remove special markers from display
        read: !!m.readAt,
        createdAt: m.createdAt.toISOString(),
        senderId: m.senderId,
        sender: m.sender
          ? {
              id: m.sender.id,
              display: m.sender.email || m.sender.walletAddress,
              role: m.sender.role,
            }
          : null,
        // Raffle win info
        winnerId: winnerId,
        canClaim: canClaim,
        // Avatar prompt info - only show upload if user still needs avatar
        isAvatarPrompt: isAvatarPrompt,
        showAvatarUpload: isAvatarPrompt && userNeedsAvatar,
      };
    }),
  });
}
