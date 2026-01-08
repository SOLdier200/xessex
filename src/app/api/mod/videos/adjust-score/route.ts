import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { clampInt } from "@/lib/scoring";

/**
 * POST /api/mod/videos/adjust-score
 * Admin/Mod adjust video adminScore ±1 using Source ID (comment ID)
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
    sourceCommentId?: string;
    direction?: number;
  } | null;

  const sourceCommentId = body?.sourceCommentId?.trim();
  const direction = body?.direction;

  if (!sourceCommentId || (direction !== 1 && direction !== -1)) {
    return NextResponse.json(
      { ok: false, error: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  // Validate comment exists and is active
  const comment = await db.comment.findUnique({
    where: { id: sourceCommentId },
  });

  if (!comment || comment.status !== "ACTIVE") {
    return NextResponse.json(
      { ok: false, error: "COMMENT_NOT_FOUND" },
      { status: 404 }
    );
  }

  // Get the video
  const video = await db.video.findUnique({
    where: { id: comment.videoId },
  });

  if (!video) {
    return NextResponse.json(
      { ok: false, error: "VIDEO_NOT_FOUND" },
      { status: 404 }
    );
  }

  // Calculate new score (clamp 0-100)
  const nextScore = clampInt(video.adminScore + direction, 0, 100);

  // Create adjustment record and update video in transaction
  const [adjustment] = await db.$transaction([
    db.videoScoreAdjustment.create({
      data: {
        videoId: video.id,
        commentId: comment.id,
        modId: access.user.id,
        direction,
      },
    }),
    db.video.update({
      where: { id: video.id },
      data: { adminScore: nextScore },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    adjustment,
    videoId: video.id,
    adminScore: nextScore,
  });
}
