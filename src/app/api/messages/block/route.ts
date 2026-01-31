/**
 * POST /api/messages/block
 * Block a user from sending you messages
 *
 * POST /api/messages/block { userId: string } - Block a user
 * POST /api/messages/block { userId: string, unblock: true } - Unblock a user
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
  const userId = body?.userId?.trim();
  const unblock = body?.unblock === true;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "MISSING_USER_ID" }, { status: 400 });
  }

  // Can't block yourself
  if (userId === access.user.id) {
    return NextResponse.json({ ok: false, error: "CANNOT_BLOCK_SELF" }, { status: 400 });
  }

  // Check if user exists
  const targetUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!targetUser) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  if (unblock) {
    // Remove block
    await db.userBlock.deleteMany({
      where: {
        blockerId: access.user.id,
        blockedId: userId,
      },
    });

    return NextResponse.json({ ok: true, blocked: false });
  } else {
    // Create block (upsert to handle duplicate attempts)
    await db.userBlock.upsert({
      where: {
        blockerId_blockedId: {
          blockerId: access.user.id,
          blockedId: userId,
        },
      },
      create: {
        blockerId: access.user.id,
        blockedId: userId,
      },
      update: {},
    });

    return NextResponse.json({ ok: true, blocked: true });
  }
}

/**
 * GET /api/messages/block
 * Get list of users you've blocked
 */
export async function GET() {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const blocks = await db.userBlock.findMany({
    where: { blockerId: access.user.id },
    include: {
      blocked: {
        select: { id: true, email: true, walletAddress: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    blockedUsers: blocks.map((b) => ({
      id: b.blocked.id,
      display: b.blocked.email || b.blocked.walletAddress || "Unknown",
      blockedAt: b.createdAt.toISOString(),
    })),
  });
}
