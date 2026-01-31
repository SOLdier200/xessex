/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { truncWallet } from "@/lib/scoring";
import { weekKeyUTC } from "@/lib/weekKey";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";

// Special credits reward for commenting
const COMMENT_CREDIT_REWARD = 2n; // 2 credits per comment (once per video)

const FLIP_WINDOW_MS = 60_000;

/**
 * GET /api/comments?videoId=...
 * List comments for a video (public counts, no mod vote details)
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

  const access = await getAccessContext();
  const userId = access.user?.id ?? null;

  const comments = await db.comment.findMany({
    where: { videoId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { walletAddress: true, email: true } },
      memberVotes: {
        select: {
          value: true,
          voterId: true,
          flipCount: true,
          createdAt: true, // For 60s window calculation
        },
      },
    },
  });

  const now = Date.now();

  const shaped = comments.map((c) => {
    // Use cached counters from Comment model
    const { memberLikes, memberDislikes } = c;

    const myVoteRow = userId
      ? c.memberVotes.find((v) => v.voterId === userId) ?? null
      : null;

    const userVote = myVoteRow ? myVoteRow.value : null;

    // Lock logic for this user (only)
    let voteLocked = false;
    let secondsLeftToFlip = 0;

    if (myVoteRow) {
      const windowPassed = now - myVoteRow.createdAt.getTime() > FLIP_WINDOW_MS;
      const flipUsed = (myVoteRow.flipCount ?? 0) >= 1;

      voteLocked = flipUsed || windowPassed;

      if (!voteLocked) {
        secondsLeftToFlip = Math.max(
          0,
          Math.ceil(
            (FLIP_WINDOW_MS - (now - myVoteRow.createdAt.getTime())) / 1000
          )
        );
      }
    }

    return {
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      authorId: c.authorId,
      authorWallet: truncWallet(c.author.walletAddress, c.author.email),
      memberLikes,
      memberDislikes,
      userVote,
      voteLocked,
      secondsLeftToFlip,
    };
  });

  // Check if user already has a comment on this video
  const hasUserComment = userId
    ? comments.some((c) => c.authorId === userId)
    : false;

  const isAdminOrMod = !!access.isAdminOrMod;

  return NextResponse.json({
    ok: true,
    comments: shaped,
    hasUserComment,
    currentUserId: userId,
    isAdminOrMod,
  });
}

/**
 * POST /api/comments
 * Create a comment (Diamond only, permanent - no edit/delete)
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (!access.canComment) {
    return NextResponse.json(
      { ok: false, error: "DIAMOND_ONLY" },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    videoId?: string;
    text?: string;
  } | null;

  const videoId = body?.videoId?.trim();
  const text = body?.text?.trim();

  if (!videoId || !text) {
    return NextResponse.json(
      { ok: false, error: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  if (text.length < 3 || text.length > 2000) {
    return NextResponse.json(
      { ok: false, error: "BAD_LENGTH" },
      { status: 400 }
    );
  }

  const video = await db.video.findUnique({ where: { id: videoId } });
  if (!video) {
    return NextResponse.json(
      { ok: false, error: "VIDEO_NOT_FOUND" },
      { status: 404 }
    );
  }

  // Check if user already has a comment on this video (1 per member per video)
  const existingComment = await db.comment.findFirst({
    where: { videoId, authorId: access.user.id },
  });
  if (existingComment) {
    return NextResponse.json(
      { ok: false, error: "ALREADY_COMMENTED" },
      { status: 400 }
    );
  }

  const wk = weekKeyUTC(new Date());

  // Create comment and track stats in a transaction
  const comment = await db.$transaction(async (tx) => {
    const newComment = await tx.comment.create({
      data: {
        videoId,
        authorId: access.user!.id,
        body: text,
        memberLikes: 0,
        memberDislikes: 0,
        score: 0,
      },
      include: {
        author: { select: { walletAddress: true, email: true } },
      },
    });

    // Track Diamond comment activity for weekly rewards (min 7 chars quality gate)
    console.log("[comments] wk", wk, "len", text.length, "user", access.user!.id);
    if (text.length >= 7) {
      console.log("[comments] eligible -> increment diamondComments");
      await tx.weeklyUserStat.upsert({
        where: { weekKey_userId: { weekKey: wk, userId: access.user!.id } },
        create: { weekKey: wk, userId: access.user!.id, diamondComments: 1, mvmPoints: 0, scoreReceived: 0 },
        update: { diamondComments: { increment: 1 } },
      });
    } else {
      console.log("[comments] NOT eligible -> too short");
    }

    // Award special credits for commenting (2 credits, once per video)
    // Use ledger refId to track uniqueness: "comment_credit_{userId}_{videoId}"
    const creditRefId = `comment_credit_${access.user!.id}_${videoId}`;
    const existingCredit = await tx.specialCreditLedger.findFirst({
      where: { refId: creditRefId },
    });

    let creditsAwarded = 0n;
    if (!existingCredit) {
      // Ensure user has a credit account
      await tx.specialCreditAccount.upsert({
        where: { userId: access.user!.id },
        create: { userId: access.user!.id, balanceMicro: 0n },
        update: {},
      });

      // Award credits
      const rewardMicro = COMMENT_CREDIT_REWARD * CREDIT_MICRO;
      await tx.specialCreditAccount.update({
        where: { userId: access.user!.id },
        data: { balanceMicro: { increment: rewardMicro } },
      });

      // Record in ledger
      await tx.specialCreditLedger.create({
        data: {
          userId: access.user!.id,
          weekKey: wk,
          amountMicro: rewardMicro,
          reason: "Comment reward",
          refType: "COMMENT_CREDIT",
          refId: creditRefId,
        },
      });

      creditsAwarded = COMMENT_CREDIT_REWARD;
      console.log("[comments] Awarded", creditsAwarded.toString(), "special credits for commenting");
    }

    return { comment: newComment, creditsAwarded: Number(creditsAwarded) };
  });

  return NextResponse.json({
    ok: true,
    comment: {
      id: comment.comment.id,
      body: comment.comment.body,
      createdAt: comment.comment.createdAt.toISOString(),
      authorWallet: truncWallet(comment.comment.author.walletAddress, comment.comment.author.email),
      memberLikes: 0,
      memberDislikes: 0,
      userVote: null,
      voteLocked: false,
      secondsLeftToFlip: 0,
    },
    creditsEarned: comment.creditsAwarded,
  });
}
