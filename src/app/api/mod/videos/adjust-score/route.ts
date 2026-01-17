import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getAccessContext } from "@/lib/access";
import { clampInt } from "@/lib/scoring";
import { weekKeyUTC, monthKeyUTC } from "@/lib/weekKey";
import { recomputeVideoRanks } from "@/lib/videoRank";

/**
 * POST /api/mod/videos/adjust-score
 * Admin/Mod adjust video adminScore ±1 using Source ID (comment ID)
 *
 * Rule: each Admin/Mod can source a given comment only once (per modId+commentId).
 * Effect: on first-time source, award comment author +1 MVM point.
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    sourceCommentId?: string;
    direction?: number;
  } | null;

  const sourceCommentId = body?.sourceCommentId?.trim();
  const direction = body?.direction;

  if (!sourceCommentId || (direction !== 1 && direction !== -1)) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const comment = await db.comment.findUnique({
    where: { id: sourceCommentId },
    select: {
      id: true,
      status: true,
      videoId: true,
      authorId: true,
    },
  });

  if (!comment || comment.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, error: "COMMENT_NOT_FOUND" }, { status: 404 });
  }

  // Prevent admins/mods from grading their own comments
  if (comment.authorId === access.user.id) {
    return NextResponse.json({ ok: false, error: "CANNOT_GRADE_OWN_COMMENT" }, { status: 403 });
  }

  const video = await db.video.findUnique({
    where: { id: comment.videoId },
    select: { id: true, adminScore: true },
  });

  if (!video) {
    return NextResponse.json({ ok: false, error: "VIDEO_NOT_FOUND" }, { status: 404 });
  }

  const nextScore = clampInt((video.adminScore ?? 75) + direction, 0, 100);

  try {
    const result = await db.$transaction(async (tx) => {
      // Enforce "each mod can source this comment only once"
      // Create the source-grade event first; if it already exists, Prisma throws P2002.
      let sourceEventId: string;

      try {
        const sourceEvent = await tx.commentSourceGrade.create({
          data: {
            commentId: comment.id,
            videoId: video.id,
            modId: access.user!.id,
            authorId: comment.authorId,
            direction,
          },
          select: { id: true },
        });
        sourceEventId = sourceEvent.id;
      } catch (e: unknown) {
        const prismaError = e as { code?: string };
        if (prismaError?.code === "P2002") {
          return { ok: false as const, error: "ALREADY_SOURCED_BY_YOU" as const };
        }
        throw e;
      }

      // Log the score adjustment (existing table)
      const adjustment = await tx.videoScoreAdjustment.create({
        data: {
          videoId: video.id,
          commentId: comment.id,
          modId: access.user!.id,
          direction,
        },
      });

      // Update video score
      const updatedVideo = await tx.video.update({
        where: { id: video.id },
        data: { adminScore: nextScore },
        select: { id: true, adminScore: true },
      });

      // Award MVM point to comment author (because THIS mod sourced it for first time)
      await tx.user.update({
        where: { id: comment.authorId },
        data: { mvmPoints: { increment: 1 } },
        select: { id: true },
      });

      // Track weekly MVM points for rewards
      const wk = weekKeyUTC(new Date());
      await tx.weeklyUserStat.upsert({
        where: { weekKey_userId: { weekKey: wk, userId: comment.authorId } },
        create: { weekKey: wk, userId: comment.authorId, mvmPoints: 1, diamondComments: 0, scoreReceived: 0 },
        update: { mvmPoints: { increment: 1 } },
      });

      // Track monthly MVM points for monthly leaderboard
      const mk = monthKeyUTC(new Date());
      await tx.monthlyUserStat.upsert({
        where: { monthKey_userId: { monthKey: mk, userId: comment.authorId } },
        create: { monthKey: mk, userId: comment.authorId, mvmPoints: 1 },
        update: { mvmPoints: { increment: 1 } },
      });

      await recomputeVideoRanks(tx);

      return {
        ok: true as const,
        adjustment,
        sourceEventId,
        videoId: updatedVideo.id,
        adminScore: updatedVideo.adminScore,
      };
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("[ADJUST_SCORE] error", e);
    const isDev = process.env.NODE_ENV !== "production";
    const detail = isDev
      ? e instanceof Error
        ? e.message
        : String(e)
      : undefined;
    const code =
      e instanceof Prisma.PrismaClientKnownRequestError
        ? e.code
        : undefined;
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", detail, code },
      { status: 500 }
    );
  }
}
