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
import { notifyMods, getUserDisplayString } from "@/lib/modNotifications";

const STAR_ABUSE_THRESHOLD_TOTAL = 10; // Number of 1-star ratings ever before warning
const STAR_ABUSE_THRESHOLD_WINDOW = 5; // Number of 1-star ratings in time window before warning
const STAR_ABUSE_WINDOW_MINUTES = 15; // Time window in minutes

// Auto-block thresholds (more severe - triggers immediate ban)
const STAR_SPAM_THRESHOLD = 10; // Number of 1-star ratings in window to trigger auto-block
const STAR_SPAM_WINDOW_MINUTES = 10; // Time window for spam detection

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
    // Check if user is rating banned vs just not having permission
    if (access.isRatingBanned) {
      return NextResponse.json(
        { ok: false, error: "RATING_BANNED" },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, error: "DIAMOND_ONLY" }, { status: 403 });
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
  let starSpamBlocked = false;

  if (s === 1) {
    try {
      // Count 1-star ratings in the spam detection window (10 minutes)
      const spamWindowStart = new Date(Date.now() - STAR_SPAM_WINDOW_MINUTES * 60 * 1000);
      const oneStarCountSpamWindow = await db.videoStarRating.count({
        where: {
          userId,
          stars: 1,
          createdAt: { gte: spamWindowStart },
        },
      });

      // Check for spam: 10 1-star ratings in 10 minutes = auto-block
      if (oneStarCountSpamWindow >= STAR_SPAM_THRESHOLD) {
        // Auto-block user from ratings and flag for mod review
        await db.$transaction([
          // Ban the user from ratings
          db.user.update({
            where: { id: userId },
            data: {
              ratingBanStatus: "TEMP_BANNED",
              ratingBanReason: `Auto-blocked: ${oneStarCountSpamWindow} 1-star ratings in ${STAR_SPAM_WINDOW_MINUTES} minutes (spam detection)`,
              // No expiry - must be manually reinstated by mod
              ratingBanUntil: null,
            },
          }),
          // Create/update star abuse warning for mod dashboard
          db.starAbuseWarning.upsert({
            where: { userId },
            create: {
              userId,
              oneStarCount: oneStarCountSpamWindow,
              autoBlocked: true,
            },
            update: {
              oneStarCount: oneStarCountSpamWindow,
              autoBlocked: true,
              acknowledged: false,
            },
          }),
          // Send message to user
          db.userMessage.create({
            data: {
              userId,
              type: "WARNING",
              subject: "Rating Privileges Suspended",
              body: "DO NOT SPAM OUR SITE. Your rating privileges have been suspended due to suspicious activity. If you feel this was an error, message support@xessex.me",
            },
          }),
          // Log mod action
          db.modAction.create({
            data: {
              modId: "SYSTEM",
              targetUserId: userId,
              actionType: "RATING_AUTO_BLOCK",
              reason: `Auto-blocked: ${oneStarCountSpamWindow} 1-star ratings in ${STAR_SPAM_WINDOW_MINUTES} minutes`,
              details: JSON.stringify({
                oneStarCount: oneStarCountSpamWindow,
                windowMinutes: STAR_SPAM_WINDOW_MINUTES,
              }),
            },
          }),
        ]);

        console.log(`[ratings] SPAM BLOCK: User ${userId} auto-blocked for ${oneStarCountSpamWindow} 1-star ratings in ${STAR_SPAM_WINDOW_MINUTES} minutes`);
        starSpamBlocked = true;

        // Notify mods about the auto-block
        const targetUser = await db.user.findUnique({
          where: { id: userId },
          select: { email: true, walletAddress: true, id: true },
        });
        if (targetUser) {
          notifyMods({
            type: "STAR_SPAM_AUTO_BLOCK",
            targetUserId: userId,
            targetUserDisplay: getUserDisplayString(targetUser),
            details: `Gave ${oneStarCountSpamWindow} videos a 1-star rating within ${STAR_SPAM_WINDOW_MINUTES} minutes.`,
          });
        }
      } else {
        // Check for warning threshold (less severe, just a warning)
        const existingWarning = await db.starAbuseWarning.findFirst({
          where: { userId },
        });

        if (!existingWarning) {
          // Count total 1-star ratings ever
          const oneStarCountTotal = await db.videoStarRating.count({
            where: { userId, stars: 1 },
          });

          // Count 1-star ratings in the warning window (15 minutes)
          const windowStart = new Date(Date.now() - STAR_ABUSE_WINDOW_MINUTES * 60 * 1000);
          const oneStarCountWindow = await db.videoStarRating.count({
            where: {
              userId,
              stars: 1,
              createdAt: { gte: windowStart },
            },
          });

          // Trigger warning if either threshold is met
          const triggeredByTotal = oneStarCountTotal >= STAR_ABUSE_THRESHOLD_TOTAL;
          const triggeredByWindow = oneStarCountWindow >= STAR_ABUSE_THRESHOLD_WINDOW;

          if (triggeredByTotal || triggeredByWindow) {
            const reason = triggeredByWindow
              ? `${oneStarCountWindow} videos a 1-star rating within ${STAR_ABUSE_WINDOW_MINUTES} minutes`
              : `${oneStarCountTotal} videos a 1-star rating`;

            // Create warning record and send message
            await db.$transaction([
              db.starAbuseWarning.create({
                data: {
                  userId,
                  oneStarCount: oneStarCountTotal,
                },
              }),
              db.userMessage.create({
                data: {
                  userId,
                  type: "WARNING",
                  subject: "Star Rating Warning",
                  body: `You have given ${reason}. Systematic low ratings that appear to be spam or abuse may result in your rating privileges being suspended. Please ensure your ratings reflect genuine assessments of video quality.`,
                },
              }),
            ]);

            console.log(`[ratings] Star abuse warning sent to user ${userId} (total: ${oneStarCountTotal}, window: ${oneStarCountWindow})`);
            starAbuseWarning = true;

            // Notify mods about the warning
            const targetUser = await db.user.findUnique({
              where: { id: userId },
              select: { email: true, walletAddress: true, id: true },
            });
            if (targetUser) {
              notifyMods({
                type: "STAR_ABUSE_WARNING",
                targetUserId: userId,
                targetUserDisplay: getUserDisplayString(targetUser),
                details: `Has given ${reason}. Warning issued.`,
              });
            }
          }
        }
      }
    } catch (e) {
      console.error("[ratings] Star abuse check failed:", e);
    }
  }

  return NextResponse.json({ ok: true, avgStars, starsCount, starAbuseWarning, starSpamBlocked });
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
