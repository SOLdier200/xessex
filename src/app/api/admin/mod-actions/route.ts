/**
 * GET /api/admin/mod-actions
 * Returns all moderator actions for admin review
 * Query params:
 *   - modId: Filter by specific moderator
 *   - limit: Number of results (default 100)
 *   - offset: Pagination offset (default 0)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const access = await getAccessContext();

  // Admin only
  if (!access.user || access.user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const modId = searchParams.get("modId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
  const offset = parseInt(searchParams.get("offset") || "0");

  // Build where clause
  const where: Record<string, unknown> = {};
  if (modId) {
    where.modId = modId;
  }

  // Get total count
  const total = await db.modAction.count({ where });

  // Get mod actions with related user info
  const actions = await db.modAction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    include: {
      mod: {
        select: {
          id: true,
          email: true,
          walletAddress: true,
          role: true,
        },
      },
      targetUser: {
        select: {
          id: true,
          email: true,
          walletAddress: true,
        },
      },
    },
  });

  // Get list of unique moderators for filter dropdown
  const moderators = await db.user.findMany({
    where: { role: { in: ["MOD", "ADMIN"] } },
    select: {
      id: true,
      email: true,
      walletAddress: true,
      role: true,
    },
  });

  // Get action counts by mod
  const actionCounts = await db.modAction.groupBy({
    by: ["modId"],
    _count: { id: true },
  });

  const countMap = new Map(actionCounts.map((c) => [c.modId, c._count.id]));

  return NextResponse.json({
    ok: true,
    total,
    limit,
    offset,
    actions: actions.map((a) => ({
      id: a.id,
      modId: a.modId,
      modDisplay: a.mod.email || a.mod.walletAddress || a.modId.slice(0, 8),
      modRole: a.mod.role,
      targetUserId: a.targetUserId,
      targetUserDisplay: a.targetUser.email || a.targetUser.walletAddress || a.targetUserId.slice(0, 8),
      actionType: a.actionType,
      actionSubtype: a.actionSubtype,
      reason: a.reason,
      details: a.details ? JSON.parse(a.details) : null,
      createdAt: a.createdAt.toISOString(),
    })),
    moderators: moderators.map((m) => ({
      id: m.id,
      display: m.email || m.walletAddress || m.id.slice(0, 8),
      role: m.role,
      actionCount: countMap.get(m.id) || 0,
    })),
  });
}
