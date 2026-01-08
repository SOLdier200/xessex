import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { clampInt } from "@/lib/scoring";

/**
 * POST /api/ratings
 * 5-star rating (Diamond only)
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (!access.canRateStars) {
    return NextResponse.json(
      { ok: false, error: "DIAMOND_ONLY" },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    videoId?: string;
    stars?: number;
  } | null;

  const videoId = body?.videoId?.trim();
  const stars = body?.stars;

  if (!videoId || typeof stars !== "number") {
    return NextResponse.json(
      { ok: false, error: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const s = clampInt(stars, 1, 5);

  const video = await db.video.findUnique({ where: { id: videoId } });
  if (!video) {
    return NextResponse.json(
      { ok: false, error: "VIDEO_NOT_FOUND" },
      { status: 404 }
    );
  }

  // Upsert rating (allow updates)
  await db.videoStarRating.upsert({
    where: {
      videoId_userId: { videoId, userId: access.user.id },
    },
    create: { videoId, userId: access.user.id, stars: s },
    update: { stars: s },
  });

  // Update cached aggregates on video
  const agg = await db.videoStarRating.aggregate({
    where: { videoId },
    _avg: { stars: true },
    _count: { stars: true },
  });

  await db.video.update({
    where: { id: videoId },
    data: {
      avgStars: agg._avg.stars ?? 0,
      starsCount: agg._count.stars ?? 0,
    },
  });

  return NextResponse.json({
    ok: true,
    avgStars: agg._avg.stars ?? 0,
    starsCount: agg._count.stars ?? 0,
  });
}

/**
 * GET /api/ratings?videoId=...
 * Get rating stats for a video
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json(
      { ok: false, error: "MISSING_VIDEO_ID" },
      { status: 400 }
    );
  }

  const video = await db.video.findUnique({
    where: { id: videoId },
    select: { avgStars: true, starsCount: true },
  });

  if (!video) {
    return NextResponse.json(
      { ok: false, error: "VIDEO_NOT_FOUND" },
      { status: 404 }
    );
  }

  // Check if current user has rated
  const access = await getAccessContext();
  let userRating: number | null = null;

  if (access.user) {
    const existing = await db.videoStarRating.findUnique({
      where: {
        videoId_userId: { videoId, userId: access.user.id },
      },
    });
    userRating = existing?.stars ?? null;
  }

  return NextResponse.json({
    ok: true,
    avgStars: video.avgStars,
    starsCount: video.starsCount,
    userRating,
  });
}
