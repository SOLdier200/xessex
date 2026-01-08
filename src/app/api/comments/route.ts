import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { truncWallet } from "@/lib/scoring";

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
  const userId = access.user?.id;

  const comments = await db.comment.findMany({
    where: { videoId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { walletAddress: true } },
      memberVotes: { select: { value: true, voterId: true } },
    },
  });

  const shaped = comments.map((c) => {
    const memberLikes = c.memberVotes.filter((v) => v.value === 1).length;
    const memberDislikes = c.memberVotes.filter((v) => v.value === -1).length;
    const userVote = userId
      ? c.memberVotes.find((v) => v.voterId === userId)?.value ?? null
      : null;

    return {
      id: c.id, // Source ID
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      authorWallet: truncWallet(c.author.walletAddress),
      memberLikes,
      memberDislikes,
      userVote,
    };
  });

  return NextResponse.json({ ok: true, comments: shaped });
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

  // Create comment - permanent, no edit/delete routes exist
  const comment = await db.comment.create({
    data: {
      videoId,
      authorId: access.user.id,
      body: text,
    },
    include: {
      author: { select: { walletAddress: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    comment: {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      authorWallet: truncWallet(comment.author.walletAddress),
      memberLikes: 0,
      memberDislikes: 0,
      userVote: null,
    },
  });
}
