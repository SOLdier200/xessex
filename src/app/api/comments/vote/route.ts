import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { weekKeyUTC } from "@/lib/weekKey";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";

// Special credits reward for voting
const VOTE_CREDIT_REWARD = 1n; // 1 credit per vote (once per comment, no extra on flip)

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
    select: { id: true, authorId: true, status: true, memberLikes: true, memberDislikes: true, score: true },
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

    const updated = await db.$transaction(async (tx) => {
      // Use CommentModVote for admin/mod, CommentMemberVote for regular users
      if (isModVote) {
        await tx.commentModVote.create({
          data: {
            commentId,
            modId: voterId,
            value,
            flipCount: 0,
            lastChangedAt: new Date(),
          },
        });
      } else {
        await tx.commentMemberVote.create({
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
      const c = await tx.comment.update({
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

      // Track score for author (positive deltas only for weekly)
      if (scoreDelta > 0) {
        await tx.weeklyUserStat.upsert({
          where: { weekKey_userId: { weekKey: wk, userId: c.authorId } },
          create: {
            weekKey: wk,
            userId: c.authorId,
            scoreReceived: scoreDelta,
            diamondComments: 0,
            mvmPoints: 0,
          },
          update: {
            scoreReceived: { increment: scoreDelta },
          },
        });
      }

      // Update all-time stats for author (always track score)
      await tx.allTimeUserStat.upsert({
        where: { userId: c.authorId },
        create: { userId: c.authorId, scoreReceived: scoreDelta > 0 ? scoreDelta : 0 },
        update: { scoreReceived: { increment: scoreDelta > 0 ? scoreDelta : 0 } },
      });

      // Track voter stats for all members (wallet checked at distribution time)
      // Mod votes don't count toward voter rewards
      if (!isModVote) {
        await tx.weeklyVoterStat.upsert({
          where: { weekKey_userId: { weekKey: wk, userId: voterId } },
          create: { weekKey: wk, userId: voterId, votesCast: 1 },
          update: { votesCast: { increment: 1 } },
        });
      }

      // Award special credits for voting (1 credit, once per comment)
      // Use ledger refId to track uniqueness: "vote_credit_{voterId}_{commentId}"
      const creditRefId = `vote_credit_${voterId}_${commentId}`;
      const existingCredit = await tx.specialCreditLedger.findFirst({
        where: { refId: creditRefId },
      });

      let creditsAwarded = 0n;
      if (!existingCredit) {
        // Ensure user has a credit account
        await tx.specialCreditAccount.upsert({
          where: { userId: voterId },
          create: { userId: voterId, balanceMicro: 0n },
          update: {},
        });

        // Award credits
        const rewardMicro = VOTE_CREDIT_REWARD * CREDIT_MICRO;
        await tx.specialCreditAccount.update({
          where: { userId: voterId },
          data: { balanceMicro: { increment: rewardMicro } },
        });

        // Record in ledger
        await tx.specialCreditLedger.create({
          data: {
            userId: voterId,
            weekKey: wk,
            amountMicro: rewardMicro,
            reason: "Vote reward",
            refType: "VOTE_CREDIT",
            refId: creditRefId,
          },
        });

        creditsAwarded = VOTE_CREDIT_REWARD;
        console.log("[vote] Awarded", creditsAwarded.toString(), "special credit for voting");
      }

      return { ...c, creditsAwarded: Number(creditsAwarded) };
    });

    return NextResponse.json({
      ok: true,
      userVote: value,
      memberLikes: updated.memberLikes,
      memberDislikes: updated.memberDislikes,
      modLikes: updated.modLikes,
      modDislikes: updated.modDislikes,
      voteLocked: false,
      secondsLeftToFlip: 60,
      creditsEarned: updated.creditsAwarded,
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

  const updated = await db.$transaction(async (tx) => {
    // Update vote row - use appropriate table based on voter type
    if (isModVoter) {
      await tx.commentModVote.update({
        where: { commentId_modId: { commentId, modId: voterId } },
        data: {
          value,
          flipCount: 1,
          lastChangedAt: new Date(),
        },
      });
    } else {
      await tx.commentMemberVote.update({
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

    const afterFlip = await tx.comment.update({
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

    // Update weekly stats for author (only positive deltas)
    // For flip: if going from dislike to like, we add the positive delta
    // if going from like to dislike, we don't subtract from weekly (keep earned score)
    if (netScoreDelta > 0) {
      await tx.weeklyUserStat.upsert({
        where: { weekKey_userId: { weekKey: wk, userId: afterFlip.authorId } },
        create: {
          weekKey: wk,
          userId: afterFlip.authorId,
          scoreReceived: netScoreDelta,
          diamondComments: 0,
          mvmPoints: 0,
        },
        update: {
          scoreReceived: { increment: netScoreDelta },
        },
      });
    }

    // Update all-time stats for author (only track positive deltas)
    if (netScoreDelta > 0) {
      await tx.allTimeUserStat.upsert({
        where: { userId: afterFlip.authorId },
        create: { userId: afterFlip.authorId, scoreReceived: netScoreDelta },
        update: { scoreReceived: { increment: netScoreDelta } },
      });
    }

    return afterFlip;
  });

  return NextResponse.json({
    ok: true,
    userVote: value,
    memberLikes: updated.memberLikes,
    memberDislikes: updated.memberDislikes,
    modLikes: updated.modLikes,
    modDislikes: updated.modDislikes,
    voteLocked: true, // they used their one flip
    secondsLeftToFlip: 0,
  });
}
