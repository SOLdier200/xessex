/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { clampInt } from "@/lib/scoring";
import { recomputeVideoRanks } from "@/lib/videoRank";

// Rate limit: 20 seconds between rating changes per user
const RATE_LIMIT_MS = 20 * 1000;
const ratingCooldowns = new Map<string, number>();

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

  const userId = access.user.id;

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

  // Check rate limit for this user
  const now = Date.now();
  const cooldownKey = `${userId}:${videoId}`;
  const lastRating = ratingCooldowns.get(cooldownKey);

  // Clean up old entries periodically
  if (ratingCooldowns.size > 10000) {
    const cutoff = now - RATE_LIMIT_MS;
    for (const [key, time] of ratingCooldowns) {
      if (time < cutoff) ratingCooldowns.delete(key);
    }
  }

  if (lastRating && now - lastRating < RATE_LIMIT_MS) {
    const waitSeconds = Math.ceil((RATE_LIMIT_MS - (now - lastRating)) / 1000);
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED", waitSeconds },
      { status: 429 }
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

  // Update cooldown timestamp
  ratingCooldowns.set(cooldownKey, now);

  const { avgStars, starsCount } = await db.$transaction(async (tx) => {
    // Upsert rating (allow updates)
    await tx.videoStarRating.upsert({
      where: {
        videoId_userId: { videoId, userId },
      },
      create: { videoId, userId, stars: s },
      update: { stars: s },
    });

    // Update cached aggregates on video
    const agg = await tx.videoStarRating.aggregate({
      where: { videoId },
      _avg: { stars: true },
      _count: { stars: true },
    });

    const avgStarsRaw = agg._avg.stars ?? 0;
    const avgStarsRounded = Math.round(avgStarsRaw * 100) / 100;
    const starsCount = agg._count.stars ?? 0;

    await tx.video.update({
      where: { id: videoId },
      data: {
        avgStars: avgStarsRounded,
        starsCount,
      },
    });

    return { avgStars: avgStarsRounded, starsCount };
  });

  try {
    await recomputeVideoRanks(db);
  } catch (e) {
    console.error("[RATINGS] rank recompute failed", e);
  }

  return NextResponse.json({
    ok: true,
    avgStars,
    starsCount,
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
