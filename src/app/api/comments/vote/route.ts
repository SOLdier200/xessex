import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { weekKeyUTC } from "@/lib/weekKey";

const FLIP_WINDOW_MS = 60_000;

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
    select: { id: true, authorId: true, status: true, memberLikes: true, memberDislikes: true },
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

  const existing = await db.commentMemberVote.findUnique({
    where: { commentId_voterId: { commentId, voterId } },
  });

  // First vote
  if (!existing) {
    const wk = weekKeyUTC(new Date());

    const updated = await db.$transaction(async (tx) => {
      await tx.commentMemberVote.create({
        data: {
          commentId,
          voterId,
          value,
          flipCount: 0,
          lastChangedAt: new Date(),
        },
      });

      const c = await tx.comment.update({
        where: { id: commentId },
        data: {
          memberLikes: { increment: value === 1 ? 1 : 0 },
          memberDislikes: { increment: value === -1 ? 1 : 0 },
        },
        select: { memberLikes: true, memberDislikes: true, authorId: true },
      });

      // Track weekly likes received (author gets credit) — LIKE only, first vote only
      if (value === 1) {
        await tx.weeklyUserStat.upsert({
          where: { weekKey_userId: { weekKey: wk, userId: c.authorId } },
          create: {
            weekKey: wk,
            userId: c.authorId,
            likesReceived: 1,
            diamondComments: 0,
            mvmPoints: 0,
          },
          update: { likesReceived: { increment: 1 } },
        });
      }

      return c;
    });

    return NextResponse.json({
      ok: true,
      userVote: value,
      memberLikes: updated.memberLikes,
      memberDislikes: updated.memberDislikes,
      voteLocked: false,
      secondsLeftToFlip: 60,
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
  const updated = await db.$transaction(async (tx) => {
    // Update vote row
    await tx.commentMemberVote.update({
      where: { commentId_voterId: { commentId, voterId } },
      data: {
        value,
        flipCount: 1,
        lastChangedAt: new Date(),
      },
    });

    // Update counters on comment: remove old, add new
    const afterFlip = await tx.comment.update({
      where: { id: commentId },
      data: {
        memberLikes: {
          increment: (value === 1 ? 1 : 0) + (existing.value === 1 ? -1 : 0),
        },
        memberDislikes: {
          increment: (value === -1 ? 1 : 0) + (existing.value === -1 ? -1 : 0),
        },
      },
      select: { memberLikes: true, memberDislikes: true },
    });

    return afterFlip;
  });

  return NextResponse.json({
    ok: true,
    userVote: value,
    memberLikes: updated.memberLikes,
    memberDislikes: updated.memberDislikes,
    voteLocked: true, // they used their one flip
    secondsLeftToFlip: 0,
  });
}
