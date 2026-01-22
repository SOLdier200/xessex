import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { weekKeyUTC } from "@/lib/weekKey";

const ONE_MIN = 60_000;

// Score weights for mod voting
const MOD_LIKE_SCORE = 15;
const MOD_DISLIKE_SCORE = -20;

function getScoreDelta(value: number): number {
  return value === 1 ? MOD_LIKE_SCORE : MOD_DISLIKE_SCORE;
}

/**
 * POST /api/mod/comments/vote
 * Admin/Mod hidden vote on comments (not displayed publicly)
 * Rules: flip ≤5
 *
 * Score weights:
 * - Mod LIKE: +15
 * - Mod DISLIKE: -20
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (!access.isAdminOrMod) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    commentId?: string;
    value?: number;
  } | null;

  const commentId = body?.commentId?.trim();
  const value = body?.value;

  if (!commentId || (value !== 1 && value !== -1)) {
    return NextResponse.json(
      { ok: false, error: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, status: true, score: true },
  });
  if (!comment || comment.status !== "ACTIVE") {
    return NextResponse.json(
      { ok: false, error: "COMMENT_NOT_FOUND" },
      { status: 404 }
    );
  }

  const existing = await db.commentModVote.findUnique({
    where: {
      commentId_modId: { commentId, modId: access.user.id },
    },
  });

  const now = Date.now();
  const wk = weekKeyUTC(new Date());

  if (!existing) {
    // Create new vote and update scores
    const scoreDelta = getScoreDelta(value);

    const result = await db.$transaction(async (tx) => {
      const created = await tx.commentModVote.create({
        data: {
          commentId,
          modId: access.user!.id,
          value,
          flipCount: 0,
          lastChangedAt: new Date(),
        },
      });

      // Update comment score
      await tx.comment.update({
        where: { id: commentId },
        data: { score: { increment: scoreDelta } },
      });

      // Update weekly score for author (positive deltas only)
      if (scoreDelta > 0) {
        await tx.weeklyUserStat.upsert({
          where: { weekKey_userId: { weekKey: wk, userId: comment.authorId } },
          create: {
            weekKey: wk,
            userId: comment.authorId,
            scoreReceived: scoreDelta,
            diamondComments: 0,
            mvmPoints: 0,
          },
          update: { scoreReceived: { increment: scoreDelta } },
        });
      }

      // Update all-time stats for author (positive deltas only)
      if (scoreDelta > 0) {
        await tx.allTimeUserStat.upsert({
          where: { userId: comment.authorId },
          create: { userId: comment.authorId, scoreReceived: scoreDelta },
          update: { scoreReceived: { increment: scoreDelta } },
        });
      }

      return created;
    });

    return NextResponse.json({ ok: true, vote: result });
  }

  // Same vote - no-op
  if (existing.value === value) {
    return NextResponse.json({ ok: true, vote: existing });
  }

  // Optional rate limit for hygiene
  if (now - existing.lastChangedAt.getTime() < ONE_MIN) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMIT_1_PER_MINUTE" },
      { status: 429 }
    );
  }

  // Flip limit: ≤5
  if (existing.flipCount >= 5) {
    return NextResponse.json(
      { ok: false, error: "FLIP_LIMIT_REACHED" },
      { status: 403 }
    );
  }

  // Update vote (flip) and recalculate scores
  const oldScoreDelta = getScoreDelta(existing.value);
  const newScoreDelta = getScoreDelta(value);
  const netScoreDelta = newScoreDelta - oldScoreDelta;

  const updated = await db.$transaction(async (tx) => {
    const vote = await tx.commentModVote.update({
      where: { id: existing.id },
      data: {
        value,
        flipCount: { increment: 1 },
        lastChangedAt: new Date(),
      },
    });

    // Update comment score
    await tx.comment.update({
      where: { id: commentId },
      data: { score: { increment: netScoreDelta } },
    });

    // Update weekly score for author (positive deltas only)
    if (netScoreDelta > 0) {
      await tx.weeklyUserStat.upsert({
        where: { weekKey_userId: { weekKey: wk, userId: comment.authorId } },
        create: {
          weekKey: wk,
          userId: comment.authorId,
          scoreReceived: netScoreDelta,
          diamondComments: 0,
          mvmPoints: 0,
        },
        update: { scoreReceived: { increment: netScoreDelta } },
      });
    }

    // Update all-time stats for author (positive deltas only)
    if (netScoreDelta > 0) {
      await tx.allTimeUserStat.upsert({
        where: { userId: comment.authorId },
        create: { userId: comment.authorId, scoreReceived: netScoreDelta },
        update: { scoreReceived: { increment: netScoreDelta } },
      });
    }

    return vote;
  });

  return NextResponse.json({ ok: true, vote: updated });
}
