/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { clampInt } from "@/lib/scoring";
import { recomputeVideoRanks } from "@/lib/videoRank";
import { weekKeyUTC } from "@/lib/weekKey";
import { poolFromVideoKind, startOfDayUTC, FLAT_RATES } from "@/lib/rewardPool";

const STAR_ABUSE_THRESHOLD = 10; // Number of 1-star ratings before warning

// Rate limit: 20 seconds between rating changes per user+video
const RATE_LIMIT_MS = 20 * 1000;
const ratingCooldowns = new Map<string, number>();

/**
 * POST /api/ratings
 * 5-star rating (Diamond only)
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!access.canRateStars) {
    return NextResponse.json({ ok: false, error: "DIAMOND_ONLY" }, { status: 403 });
  }

  // Check if user is banned from rating
  const userRecord = await db.user.findUnique({
    where: { id: access.user.id },
    select: { ratingBanStatus: true, ratingBanUntil: true },
  });

  if (userRecord?.ratingBanStatus === "PERM_BANNED") {
    return NextResponse.json(
      { ok: false, error: "RATING_BANNED", reason: "You are permanently banned from rating videos." },
      { status: 403 }
    );
  }

  if (userRecord?.ratingBanStatus === "TEMP_BANNED") {
    const banUntil = userRecord.ratingBanUntil;
    if (banUntil && banUntil > new Date()) {
      return NextResponse.json(
        { ok: false, error: "RATING_SUSPENDED", until: banUntil.toISOString() },
        { status: 403 }
      );
    }
    // Suspension has expired, allow rating (status will be cleaned up later)
  }

  const body = (await req.json().catch(() => null)) as
    | { videoId?: string; stars?: number }
    | null;

  const videoId = body?.videoId?.trim();
  const stars = body?.stars;

  if (!videoId || typeof stars !== "number") {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const userId = access.user.id;

  // Rate limit per user+video
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

  const video = await db.video.findUnique({
    where: { id: videoId },
    select: { id: true, kind: true },
  });
  if (!video) {
    return NextResponse.json({ ok: false, error: "VIDEO_NOT_FOUND" }, { status: 404 });
  }

  const pool = poolFromVideoKind(video.kind);
  const wk = weekKeyUTC(new Date());
  const dayUTC = startOfDayUTC(new Date());

  // Update cooldown timestamp
  ratingCooldowns.set(cooldownKey, now);

  // Do the rating + aggregates in a transaction
  const { avgStars, starsCount } = await db.$transaction(async (tx) => {
    // Mark daily active for rater (for "active every day" weekly bonus)
    await tx.userDailyActive.upsert({
      where: { userId_day_pool: { userId, day: dayUTC, pool } },
      create: { userId, day: dayUTC, pool },
      update: {},
    });

    // Log flat-rate "rating" action (once per video per week)
    const ratingRefId = `rating:${wk}:${userId}:${videoId}`;
    const ratingAmount = FLAT_RATES[pool].RATING;
    await tx.flatActionLedger.upsert({
      where: { refId: ratingRefId },
      create: {
        refId: ratingRefId,
        weekKey: wk,
        userId,
        pool,
        action: "RATING",
        units: 1,
        amount: ratingAmount,
      },
      update: {}, // no-op if already exists (re-rating same video same week)
    });

    await tx.videoStarRating.upsert({
      where: { videoId_userId: { videoId, userId } },
      create: { videoId, userId, stars: s },
      update: { stars: s },
    });

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
      data: { avgStars: avgStarsRounded, starsCount },
    });

    return { avgStars: avgStarsRounded, starsCount };
  });

  // Recompute ranks outside the transaction
  try {
    await recomputeVideoRanks(db);
  } catch (e) {
    // Don't fail the rating if ranking recompute fails
    console.error("[ratings] recomputeVideoRanks failed:", e);
  }

  // Check for star abuse (only if this was a 1-star rating)
  let starAbuseWarning = false;
  if (s === 1) {
    try {
      // Count how many 1-star ratings this user has given
      const oneStarCount = await db.videoStarRating.count({
        where: { userId, stars: 1 },
      });

      // If they've hit the threshold, check if they already have a warning
      if (oneStarCount >= STAR_ABUSE_THRESHOLD) {
        const existingWarning = await db.starAbuseWarning.findFirst({
          where: { userId },
        });

        if (!existingWarning) {
          // Create warning record and send message
          await db.$transaction([
            db.starAbuseWarning.create({
              data: {
                userId,
                oneStarCount,
              },
            }),
            db.userMessage.create({
              data: {
                userId,
                type: "WARNING",
                subject: "Star Rating Warning",
                body: `You have given ${oneStarCount} videos a 1-star rating. Systematic low ratings that appear to be spam or abuse may result in your rating privileges being suspended. Please ensure your ratings reflect genuine assessments of video quality.`,
              },
            }),
          ]);

          console.log(`[ratings] Star abuse warning sent to user ${userId} (${oneStarCount} 1-star ratings)`);
          starAbuseWarning = true;
        }
      }
    } catch (e) {
      console.error("[ratings] Star abuse check failed:", e);
    }
  }

  return NextResponse.json({ ok: true, avgStars, starsCount, starAbuseWarning });
}

/**
 * GET /api/ratings?videoId=...
 * Get rating stats for a video
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ ok: false, error: "MISSING_VIDEO_ID" }, { status: 400 });
  }

  const video = await db.video.findUnique({
    where: { id: videoId },
    select: { avgStars: true, starsCount: true },
  });

  if (!video) {
    return NextResponse.json({ ok: false, error: "VIDEO_NOT_FOUND" }, { status: 404 });
  }

  const access = await getAccessContext();
  let userRating: number | null = null;

  if (access.user) {
    const existing = await db.videoStarRating.findUnique({
      where: { videoId_userId: { videoId, userId: access.user.id } },
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
