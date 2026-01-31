import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { truncWallet } from "@/lib/scoring";

export const runtime = "nodejs";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function safePreview(s: string, max = 140) {
  const t = (s || "").trim().replace(/\s+/g, " ");
  return t.length > max ? t.slice(0, max - 1) + "..." : t;
}

/**
 * GET /api/mod/audit/source-grades
 *
 * Query params:
 * - limit=100 (max 500)
 * - cursor=<createdAtISO>|<id>   // pagination cursor
 * - videoId=<videoId>
 * - modId=<userId>
 * - authorId=<userId>
 * - commentId=<commentId>
 *
 * Returns:
 * - rows: newest first
 * - nextCursor: pass back for pagination
 */
export async function GET(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);

  const limitRaw = searchParams.get("limit");
  const limitNum = limitRaw ? Number(limitRaw) : 100;
  const limit = clamp(Number.isFinite(limitNum) ? Math.floor(limitNum) : 100, 1, 500);

  const videoId = searchParams.get("videoId")?.trim() || null;
  const modId = searchParams.get("modId")?.trim() || null;
  const authorId = searchParams.get("authorId")?.trim() || null;
  const commentId = searchParams.get("commentId")?.trim() || null;

  // Cursor format: "<createdAtISO>|<id>"
  const cursorRaw = searchParams.get("cursor");
  let cursorCreatedAt: Date | null = null;
  let cursorId: string | null = null;

  if (cursorRaw) {
    const [ts, id] = cursorRaw.split("|");
    const d = ts ? new Date(ts) : null;
    if (d && !Number.isNaN(d.getTime()) && id) {
      cursorCreatedAt = d;
      cursorId = id;
    }
  }

  // Build where clause
  type WhereClause = {
    videoId?: string;
    modId?: string;
    authorId?: string;
    commentId?: string;
    OR?: Array<
      | { createdAt: { lt: Date } }
      | { AND: [{ createdAt: Date }, { id: { lt: string } }] }
    >;
  };

  const where: WhereClause = {};
  if (videoId) where.videoId = videoId;
  if (modId) where.modId = modId;
  if (authorId) where.authorId = authorId;
  if (commentId) where.commentId = commentId;

  // Cursor pagination: fetch records "older than" cursor using (createdAt desc, id desc)
  if (cursorCreatedAt && cursorId) {
    where.OR = [
      { createdAt: { lt: cursorCreatedAt } },
      { AND: [{ createdAt: cursorCreatedAt }, { id: { lt: cursorId } }] },
    ];
  }

  const rows = await db.commentSourceGrade.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    include: {
      video: { select: { id: true, slug: true, title: true } },
      comment: { select: { id: true, body: true, createdAt: true } },
      mod: { select: { id: true, walletAddress: true, email: true, role: true } },
      author: { select: { id: true, walletAddress: true, email: true } },
    },
  });

  const shaped = rows.map((r) => {
    const modWallet = r.mod.walletAddress || null;
    const authorWallet = r.author.walletAddress || null;

    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      direction: r.direction,

      video: {
        id: r.video.id,
        slug: r.video.slug,
        title: r.video.title,
      },

      comment: {
        id: r.comment.id,
        createdAt: r.comment.createdAt.toISOString(),
        preview: safePreview(r.comment.body),
      },

      mod: {
        id: r.mod.id,
        role: r.mod.role,
        display: truncWallet(modWallet, r.mod.email),
      },

      author: {
        id: r.author.id,
        display: truncWallet(authorWallet, r.author.email),
      },
    };
  });

  const last = rows[rows.length - 1];
  const nextCursor = last ? `${last.createdAt.toISOString()}|${last.id}` : null;

  return NextResponse.json({
    ok: true,
    rows: shaped,
    nextCursor,
    meta: { limit, filters: { videoId, modId, authorId, commentId } },
  });
}
