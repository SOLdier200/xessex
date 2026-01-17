import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const VIDEO_SELECT = {
  id: true,
  slug: true,
  title: true,
  embedUrl: true,
  isShowcase: true,
  viewsCount: true,
  avgStars: true,
  starsCount: true,
};

async function pickShowcase(excludeViewkey: string | null) {
  const where = {
    isShowcase: true,
    ...(excludeViewkey ? { slug: { not: excludeViewkey } } : {}),
  };

  const total = await db.video.count({ where });
  if (!total) return null;

  const skip = Math.floor(Math.random() * total);
  const videos = await db.video.findMany({
    where,
    select: VIDEO_SELECT,
    orderBy: { rank: "asc" },
    skip,
    take: 1,
  });

  return videos[0] ?? null;
}

async function pickApprovedFromSqlite(excludeViewkey: string | null) {
  try {
    const sqlite = getDb();
    const stmt = sqlite.prepare(
      `
      SELECT v.viewkey
      FROM videos v
      JOIN curation c ON c.viewkey = v.viewkey
      WHERE c.status = 'approved'
        ${excludeViewkey ? "AND v.viewkey != ?" : ""}
      ORDER BY RANDOM()
      LIMIT 1
      `
    );

    type Row = { viewkey: string } | undefined;
    const row = (excludeViewkey ? stmt.get(excludeViewkey) : stmt.get()) as Row;
    return row?.viewkey;
  } catch {
    return undefined;
  }
}

export async function GET(req: NextRequest) {
  const excludeViewkey = req.nextUrl.searchParams.get("excludeViewkey") || null;
  const access = await getAccessContext();

  if (!access.canViewAllVideos) {
    const video = await pickShowcase(excludeViewkey);
    if (!video) {
      return NextResponse.json(
        { ok: false, error: "NO_NEXT_VIDEO" },
        { status: 404 }
      );
    }
    const res = NextResponse.json({ ok: true, next: video });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const viewkey = await pickApprovedFromSqlite(excludeViewkey);
    if (!viewkey) break;

    const video = await db.video.findFirst({
      where: { slug: viewkey },
      select: VIDEO_SELECT,
    });

    if (video) {
      const res = NextResponse.json({ ok: true, next: video });
      res.headers.set("Cache-Control", "no-store");
      return res;
    }
  }

  return NextResponse.json(
    { ok: false, error: "NO_NEXT_VIDEO" },
    { status: 404 }
  );
}
