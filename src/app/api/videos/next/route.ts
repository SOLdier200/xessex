import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext, canAccessVideo } from "@/lib/access";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

// SECURITY: Never select embedUrl in the initial query.
// Only fetch it in a second query after access is confirmed.
const VIDEO_SELECT_SAFE = {
  id: true,
  slug: true,
  title: true,
  viewsCount: true,
  sourceViews: true,
  avgStars: true,
  starsCount: true,
  unlockCost: true,
};

/**
 * Fetch embedUrl only after entitlement is confirmed.
 */
async function fetchEmbedUrl(videoId: string): Promise<string> {
  const row = await db.video.findUnique({
    where: { id: videoId },
    select: { embedUrl: true },
  });
  return row?.embedUrl ?? "";
}

/**
 * Pick a random free video (unlockCost = 0, active only)
 */
async function pickFreeVideo(excludeViewkey: string | null) {
  const where = {
    unlockCost: 0,
    isActive: true,
    ...(excludeViewkey ? { slug: { not: excludeViewkey } } : {}),
  };

  const total = await db.video.count({ where });
  if (!total) return null;

  const skip = Math.floor(Math.random() * total);
  const videos = await db.video.findMany({
    where,
    select: VIDEO_SELECT_SAFE,
    orderBy: { rank: "asc" },
    skip,
    take: 1,
  });

  return videos[0] ?? null;
}

/**
 * Pick a random video from approved SQLite list
 */
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

  // Not authenticated - only show free videos
  if (!access.isAuthed) {
    const video = await pickFreeVideo(excludeViewkey);
    if (!video) {
      return NextResponse.json(
        { ok: false, error: "NO_NEXT_VIDEO" },
        { status: 404 }
      );
    }
    // Free video: fetch embedUrl since it's always playable
    const embedUrl = await fetchEmbedUrl(video.id);
    const res = NextResponse.json({ ok: true, next: { ...video, embedUrl } });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // Authenticated user - try to find an unlocked video
  const userId = access.user?.id;
  const MAX_ATTEMPTS = 5;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const viewkey = await pickApprovedFromSqlite(excludeViewkey);
    if (!viewkey) break;

    const video = await db.video.findFirst({
      where: { slug: viewkey, isActive: true },
      select: VIDEO_SELECT_SAFE,
    });

    if (video && userId) {
      // Check if user can access this video
      const accessCheck = await canAccessVideo(userId, video.id);
      if (accessCheck.canAccess) {
        // User has access - fetch embedUrl only now
        const embedUrl = await fetchEmbedUrl(video.id);
        const res = NextResponse.json({ ok: true, next: { ...video, embedUrl } });
        res.headers.set("Cache-Control", "no-store");
        return res;
      }
    }
  }

  // Fallback to free video if no unlocked video found
  const freeVideo = await pickFreeVideo(excludeViewkey);
  if (freeVideo) {
    const embedUrl = await fetchEmbedUrl(freeVideo.id);
    const res = NextResponse.json({ ok: true, next: { ...freeVideo, embedUrl } });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  return NextResponse.json(
    { ok: false, error: "NO_NEXT_VIDEO" },
    { status: 404 }
  );
}
