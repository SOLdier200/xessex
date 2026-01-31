import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { isAdminOrMod } from "@/lib/admin";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/admin/unlocks
 *
 * Admin view of video unlock audit log.
 * Searchable by userId, videoId, memberId, wallet, slug, or title.
 */
export async function GET(req: NextRequest) {
  const ctx = await getAccessContext();

  if (!ctx.isAuthed || !ctx.user) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  if (!isAdminOrMod(ctx.user)) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const take = Math.min(Number(url.searchParams.get("take") ?? "50"), 200);
  const skip = Number(url.searchParams.get("skip") ?? "0");

  // Build dynamic where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = q
    ? {
        OR: [
          { userId: { contains: q } },
          { videoId: { contains: q } },
          { user: { memberId: { contains: q } } },
          { user: { walletAddress: { contains: q } } },
          
          { video: { title: { contains: q, mode: "insensitive" } } },
          { video: { slug: { contains: q, mode: "insensitive" } } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    db.videoUnlock.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        createdAt: true,
        cost: true,
        userId: true,
        videoId: true,
        user: {
          select: {
            memberId: true,
            walletAddress: true,
            role: true,
            createdAt: true,
          },
        },
        video: {
          select: { title: true, slug: true, rank: true },
        },
      },
    }),
    db.videoUnlock.count({ where }),
  ]);

  return NextResponse.json({ ok: true, total, take, skip, items });
}
