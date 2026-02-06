import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { weekKeyUTC } from "@/lib/weekKey";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";
import { poolFromVideoKind, startOfDayUTC, FLAT_RATES } from "@/lib/rewardPool";

// Force Node.js runtime (required for Prisma transactions)
export const runtime = "nodejs";

// Special credits reward for voting
const VOTE_CREDIT_REWARD_EMBED = 1n; // 1 credit per vote on embed videos
const VOTE_CREDIT_REWARD_XESSEX = 50n; // 50 credits per vote on Xessex Original videos

const FLIP_WINDOW_MS = 60_000;

// Score weights for member voting
const MEMBER_LIKE_SCORE = 5;
const ADMIN_MOD_LIKE_SCORE = 15;
const MEMBER_DISLIKE_SCORE = -1;

function getScoreDelta(value: number, isAdminOrMod: boolean): number {
  if (value === 1) {
    return isAdminOrMod ? ADMIN_MOD_LIKE_SCORE : MEMBER_LIKE_SCORE;
  }
  return MEMBER_DISLIKE_SCORE;
}

function secondsLeft(createdAt: Date, nowMs: number) {
  return Math.max(0, Math.ceil((FLIP_WINDOW_MS - (nowMs - createdAt.getTime())) / 1000));
}

/**
 * POST /api/comments/vote
 * Paid members can vote.
 * Rules:
 * - First vote anytime
 * - Can change vote ONLY ONCE, and only within 60 seconds of first vote
 * - After that, locked forever
 *
 * Score weights:
 * - Member LIKE: +5
 * - Member DISLIKE: -1
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!access.canVoteComments) {
    // Check if user is vote banned vs just not having permission
    if (access.isVoteBanned) {
      return NextResponse.json({ ok: false, error: "VOTE_BANNED" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "PAID_ONLY" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { commentId?: string; value?: number }
    | null;

  const commentId = body?.commentId?.trim();
  const value = body?.value;

  if (!commentId || (value !== 1 && value !== -1)) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const voterId = access.user.id;
  const now = Date.now();

  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, videoId: true, status: true, memberLikes: true, memberDislikes: true, score: true },
  });

  if (!comment || comment.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, error: "COMMENT_NOT_FOUND" }, { status: 404 });
  }

  // Prevent self-voting
  if (comment.authorId === voterId) {
    return NextResponse.json(
      { ok: false, error: "CANNOT_VOTE_OWN_COMMENT" },
      { status: 403 }
    );
  }

  // Check for existing vote - mods use CommentModVote, members use CommentMemberVote
  const isModVoter = access.isAdminOrMod;
  const existingModVote = isModVoter
    ? await db.commentModVote.findUnique({
        where: { commentId_modId: { commentId, modId: voterId } },
      })
    : null;
  const existingMemberVote = !isModVoter
    ? await db.commentMemberVote.findUnique({
        where: { commentId_voterId: { commentId, voterId } },
      })
    : null;
  const existing = existingModVote || existingMemberVote;


  // First vote
  if (!existing) {
    const wk = weekKeyUTC(new Date());
    const scoreDelta = getScoreDelta(value, access.isAdminOrMod);
    const isModVote = access.isAdminOrMod;

    // Fetch video kind to determine pool
    const video = await db.video.findUnique({
      where: { id: comment.videoId },
      select: { kind: true },
    });
    const pool = poolFromVideoKind(video?.kind);
    const dayUTC = startOfDayUTC(new Date());

    // Step 1: Create vote and update comment (core operation)
    let updated;
    try {
      // Use CommentModVote for admin/mod, CommentMemberVote for regular users
      if (isModVote) {
        await db.commentModVote.create({
          data: {
            commentId,
            modId: voterId,
            value,
            flipCount: 0,
            lastChangedAt: new Date(),
          },
        });
      } else {
        await db.commentMemberVote.create({
          data: {
            commentId,
            voterId,
            value,
            flipCount: 0,
            lastChangedAt: new Date(),
          },
        });
      }

      // Update different fields based on voter type
      updated = await db.comment.update({
        where: { id: commentId },
        data: isModVote
          ? {
              modLikes: { increment: value === 1 ? 1 : 0 },
              modDislikes: { increment: value === -1 ? 1 : 0 },
              score: { increment: scoreDelta },
            }
          : {
              memberLikes: { increment: value === 1 ? 1 : 0 },
              memberDislikes: { increment: value === -1 ? 1 : 0 },
              score: { increment: scoreDelta },
            },
        select: { memberLikes: true, memberDislikes: true, modLikes: true, modDislikes: true, authorId: true, score: true },
      });
    } catch (err) {
      console.error("[vote] Vote creation failed:", err);
      return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
    }

    // Step 2: Track stats (non-critical, done separately)
    try {
      // Track score for author (positive deltas only for weekly) - pool-aware
      if (scoreDelta > 0) {
        await db.weeklyUserStat.upsert({
          where: { weekKey_userId_pool: { weekKey: wk, userId: updated.authorId, pool } },
          create: {
            weekKey: wk,
            userId: updated.authorId,
            pool,
            scoreReceived: scoreDelta,
            diamondComments: 0,
            mvmPoints: 0,
            pendingAtomic: 0n,
            paidAtomic: 0n,
          },
          update: {
            scoreReceived: { increment: scoreDelta },
          },
        });

        // Update all-time stats for author - pool-aware
        await db.allTimeUserStat.upsert({
          where: { userId_pool: { userId: updated.authorId, pool } },
          create: { userId: updated.authorId, pool, scoreReceived: scoreDelta },
          update: { scoreReceived: { increment: scoreDelta } },
        });
      }

      // Track voter stats for all members - pool-aware
      // Mod votes don't count toward voter rewards
      if (!isModVote) {
        await db.weeklyVoterStat.upsert({
          where: { weekKey_userId_pool: { weekKey: wk, userId: voterId, pool } },
          create: { weekKey: wk, userId: voterId, pool, votesCast: 1 },
          update: { votesCast: { increment: 1 } },
        });

        // Mark daily active for the voter (for "active every day" weekly bonus)
        await db.userDailyActive.upsert({
          where: { userId_day_pool: { userId: voterId, day: dayUTC, pool } },
          create: { userId: voterId, day: dayUTC, pool },
          update: {},
        });
      }

      // Log flat-rate "like received" for comment author (if positive vote)
      if (value === 1) {
        const likeRefId = `like_rcvd:${wk}:${updated.authorId}:${commentId}:${voterId}`;
        const likeAmount = FLAT_RATES[pool].LIKE_RECEIVED;
        await db.flatActionLedger.upsert({
          where: { refId: likeRefId },
          create: {
            refId: likeRefId,
            weekKey: wk,
            userId: updated.authorId,
            pool,
            action: "LIKE_RECEIVED",
            units: 1,
            amount: likeAmount,
          },
          update: {}, // no-op if already exists
        });
      }
    } catch (err) {
      // Non-critical - log but don't fail the request
      console.error("[vote] Stats tracking failed (non-critical):", err);
    }

    // Step 3: Award special credits (separate small transaction)
    // 50 credits for Xessex Originals, 1 credit for embeds
    const isXessexOriginal = video?.kind === "XESSEX";
    const voteCreditsReward = isXessexOriginal ? VOTE_CREDIT_REWARD_XESSEX : VOTE_CREDIT_REWARD_EMBED;
    let creditsAwarded = 0;
    try {
      const creditRefId = `vote_credit_${voterId}_${commentId}`;
      const existingCredit = await db.specialCreditLedger.findFirst({
        where: { refId: creditRefId },
      });

      if (!existingCredit) {
        await db.$transaction(async (tx) => {
          await tx.specialCreditAccount.upsert({
            where: { userId: voterId },
            create: { userId: voterId, balanceMicro: 0n },
            update: {},
          });

          const rewardMicro = voteCreditsReward * CREDIT_MICRO;
          await tx.specialCreditAccount.update({
            where: { userId: voterId },
            data: { balanceMicro: { increment: rewardMicro } },
          });

          await tx.specialCreditLedger.create({
            data: {
              userId: voterId,
              weekKey: wk,
              amountMicro: rewardMicro,
              reason: isXessexOriginal ? "Vote reward (Xessex Original)" : "Vote reward",
              refType: "VOTE_CREDIT",
              refId: creditRefId,
            },
          });
        }, { timeout: 10000 });

        creditsAwarded = Number(voteCreditsReward);
        console.log("[vote] Awarded", creditsAwarded, "special credits for voting on", isXessexOriginal ? "Xessex Original" : "embed");
      }
    } catch (err) {
      // Non-critical - log but don't fail the request
      console.error("[vote] Credits award failed (non-critical):", err);
    }

    return NextResponse.json({
      ok: true,
      userVote: value,
      memberLikes: updated.memberLikes,
      memberDislikes: updated.memberDislikes,
      modLikes: updated.modLikes,
      modDislikes: updated.modDislikes,
      voteLocked: false,
      secondsLeftToFlip: 60,
      creditsEarned: creditsAwarded,
    });
  }

  // Compute lock status based on FIRST vote time + flipCount
  const windowPassed = now - existing.createdAt.getTime() > FLIP_WINDOW_MS;
  const flipUsed = existing.flipCount >= 1;
  const locked = windowPassed || flipUsed;

  // Same vote again = no-op (still return lock status)
  if (existing.value === value) {
    return NextResponse.json({
      ok: true,
      userVote: existing.value,
      memberLikes: comment.memberLikes,
      memberDislikes: comment.memberDislikes,
      voteLocked: locked,
      secondsLeftToFlip: locked ? 0 : secondsLeft(existing.createdAt, now),
    });
  }

  // Trying to flip
  if (flipUsed) {
    return NextResponse.json(
      { ok: false, error: "VOTE_LOCKED_FLIP_ALREADY_USED" },
      { status: 429 }
    );
  }

  if (windowPassed) {
    return NextResponse.json(
      { ok: false, error: "VOTE_LOCKED_WINDOW_EXPIRED" },
      { status: 429 }
    );
  }

  // Allowed ONE flip within 60 seconds
  const wk = weekKeyUTC(new Date());
  const oldScoreDelta = getScoreDelta(existing.value, access.isAdminOrMod);
  const newScoreDelta = getScoreDelta(value, access.isAdminOrMod);
  // Net score change = subtract old + add new
  const netScoreDelta = newScoreDelta - oldScoreDelta;

  // Fetch video kind to determine pool
  const video = await db.video.findUnique({
    where: { id: comment.videoId },
    select: { kind: true },
  });
  const pool = poolFromVideoKind(video?.kind);
  const dayUTC = startOfDayUTC(new Date());

  // Step 1: Update vote and comment (core operation)
  let afterFlip;
  try {
    // Update vote row - use appropriate table based on voter type
    if (isModVoter) {
      await db.commentModVote.update({
        where: { commentId_modId: { commentId, modId: voterId } },
        data: {
          value,
          flipCount: 1,
          lastChangedAt: new Date(),
        },
      });
    } else {
      await db.commentMemberVote.update({
        where: { commentId_voterId: { commentId, voterId } },
        data: {
          value,
          flipCount: 1,
          lastChangedAt: new Date(),
        },
      });
    }

    // Update counters on comment: remove old, add new
    const likeIncrement = (value === 1 ? 1 : 0) + (existing.value === 1 ? -1 : 0);
    const dislikeIncrement = (value === -1 ? 1 : 0) + (existing.value === -1 ? -1 : 0);

    afterFlip = await db.comment.update({
      where: { id: commentId },
      data: isModVoter
        ? {
            modLikes: { increment: likeIncrement },
            modDislikes: { increment: dislikeIncrement },
            score: { increment: netScoreDelta },
          }
        : {
            memberLikes: { increment: likeIncrement },
            memberDislikes: { increment: dislikeIncrement },
            score: { increment: netScoreDelta },
          },
      select: { memberLikes: true, memberDislikes: true, modLikes: true, modDislikes: true, authorId: true, score: true },
    });
  } catch (err) {
    console.error("[vote] Flip failed:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }

  // Step 2: Track stats (non-critical)
  try {
    // Update weekly stats for author (only positive deltas) - pool-aware
    if (netScoreDelta > 0) {
      await db.weeklyUserStat.upsert({
        where: { weekKey_userId_pool: { weekKey: wk, userId: afterFlip.authorId, pool } },
        create: {
          weekKey: wk,
          userId: afterFlip.authorId,
          pool,
          scoreReceived: netScoreDelta,
          diamondComments: 0,
          mvmPoints: 0,
          pendingAtomic: 0n,
          paidAtomic: 0n,
        },
        update: {
          scoreReceived: { increment: netScoreDelta },
        },
      });

      // Update all-time stats for author (only track positive deltas) - pool-aware
      await db.allTimeUserStat.upsert({
        where: { userId_pool: { userId: afterFlip.authorId, pool } },
        create: { userId: afterFlip.authorId, pool, scoreReceived: netScoreDelta },
        update: { scoreReceived: { increment: netScoreDelta } },
      });
    }

    // Mark daily active for the voter on flip as well (if not mod)
    if (!isModVoter) {
      await db.userDailyActive.upsert({
        where: { userId_day_pool: { userId: voterId, day: dayUTC, pool } },
        create: { userId: voterId, day: dayUTC, pool },
        update: {},
      });
    }

    // Log flat-rate "like received" for comment author (if flipping TO like)
    if (value === 1 && existing.value === -1) {
      const likeRefId = `like_rcvd:${wk}:${afterFlip.authorId}:${commentId}:${voterId}`;
      const likeAmount = FLAT_RATES[pool].LIKE_RECEIVED;
      await db.flatActionLedger.upsert({
        where: { refId: likeRefId },
        create: {
          refId: likeRefId,
          weekKey: wk,
          userId: afterFlip.authorId,
          pool,
          action: "LIKE_RECEIVED",
          units: 1,
          amount: likeAmount,
        },
        update: {}, // no-op if already exists
      });
    }
  } catch (err) {
    // Non-critical - log but don't fail the request
    console.error("[vote] Stats tracking on flip failed (non-critical):", err);
  }

  return NextResponse.json({
    ok: true,
    userVote: value,
    memberLikes: afterFlip.memberLikes,
    memberDislikes: afterFlip.memberDislikes,
    modLikes: afterFlip.modLikes,
    modDislikes: afterFlip.modDislikes,
    voteLocked: true, // they used their one flip
    secondsLeftToFlip: 0,
  });
}
