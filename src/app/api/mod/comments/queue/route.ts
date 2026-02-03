/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { truncWallet } from "@/lib/scoring";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function clampLimit(n: number) {
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(n)), MAX_LIMIT);
}

type QueueStatus = "PENDING" | "HIDDEN" | "ALL";

function parseStatus(s: string | null): QueueStatus {
  const v = (s ?? "").toUpperCase();
  if (v === "PENDING") return "PENDING";
  if (v === "HIDDEN") return "HIDDEN";
  if (v === "ALL") return "ALL";
  return "ALL";
}

/**
 * GET /api/mod/comments/queue?status=ALL|PENDING|HIDDEN&limit=30&cursor=<commentId>
 *
 * Returns newest comments awaiting moderation review.
 * Cursor pagination is based on Prisma cursor (comment id) + deterministic ordering.
 */
export async function GET(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (access.user.role !== "MOD" && access.user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusParam = parseStatus(url.searchParams.get("status"));
  const limit = clampLimit(Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT));
  const cursor = url.searchParams.get("cursor")?.trim() || null;

  const statuses =
    statusParam === "ALL" ? (["PENDING", "HIDDEN"] as const) : ([statusParam] as const);

  // Fetch limit+1 so we can compute nextCursor
  const rows = await db.comment.findMany({
    where: {
      status: { in: statuses as any },
      // Exclude moderator-removed items from the queue
      // (REMOVED should never appear here anyway, but safe)
      removedAt: null,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    select: {
      id: true,
      videoId: true,
      authorId: true,
      body: true,
      createdAt: true,
      status: true,
      autoReason: true,
      removedAt: true,
      removedById: true,
      removedReason: true,
      author: { select: { walletAddress: true, email: true } },
      video: { select: { id: true, title: true, kind: true } },
      reports: {
        where: { resolvedAt: null },
        select: { reason: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  const items = page.map((c) => {
    // Unresolved reports summary
    const reasonCounts: Record<string, number> = {};
    for (const r of c.reports) {
      const key = String(r.reason);
      reasonCounts[key] = (reasonCounts[key] ?? 0) + 1;
    }

    return {
      id: c.id,
      status: c.status,
      autoReason: c.autoReason ?? null,
      createdAt: c.createdAt.toISOString(),

      video: {
        id: c.video.id,
        videoId: c.videoId,
        title: c.video.title,
        kind: c.video.kind,
      },

      author: {
        id: c.authorId,
        authorWallet: truncWallet(c.author.walletAddress, c.author.email),
      },

      body: c.body,

      reports: {
        unresolvedCount: c.reports.length,
        reasonCounts,
        latestAt: c.reports.length ? c.reports[0].createdAt.toISOString() : null,
      },
    };
  });

  return NextResponse.json({
    ok: true,
    filter: { status: statusParam, limit },
    cursor: { nextCursor },
    items,
  });
}
