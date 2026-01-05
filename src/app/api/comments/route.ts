import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCurrentUser, isSubscriptionActive } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  // Only Diamond Members can post comments
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  if (!isSubscriptionActive(user)) {
    return NextResponse.json(
      { ok: false, error: "Diamond membership required to post comments" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { viewkey, text, authorName } = body;

  if (!viewkey || typeof viewkey !== "string") {
    return NextResponse.json(
      { ok: false, error: "Missing viewkey" },
      { status: 400 }
    );
  }

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "Comment text is required" },
      { status: 400 }
    );
  }

  if (text.length > 1000) {
    return NextResponse.json(
      { ok: false, error: "Comment too long (max 1000 characters)" },
      { status: 400 }
    );
  }

  // Use wallet address as author name if not provided
  const displayName = authorName?.trim() || user.wallet.slice(0, 4) + "..." + user.wallet.slice(-4);

  const comment = await prisma.comment.create({
    data: {
      viewkey,
      text: text.trim(),
      authorId: user.id,
      authorName: displayName,
    },
  });

  return NextResponse.json({
    ok: true,
    comment: {
      id: comment.id,
      text: comment.text,
      authorName: comment.authorName,
      createdAt: comment.createdAt.toISOString(),
      upvotes: 0,
      downvotes: 0,
      userVote: null,
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const viewkey = searchParams.get("viewkey");
  const visitorId = searchParams.get("visitorId");

  if (!viewkey) {
    return NextResponse.json(
      { ok: false, error: "Missing viewkey" },
      { status: 400 }
    );
  }

  // Fetch comments with counts (fast - no aggregation needed)
  const comments = await prisma.comment.findMany({
    where: { viewkey },
    orderBy: { createdAt: "desc" },
    include: {
      votes: visitorId
        ? {
            where: { visitorId },
            select: { vote: true },
          }
        : false,
    },
  });

  const formattedComments = comments.map((comment) => {
    // User's vote from the filtered votes array (only their vote if visitorId provided)
    const userVote = visitorId && comment.votes && comment.votes.length > 0
      ? comment.votes[0].vote
      : null;

    return {
      id: comment.id,
      text: comment.text,
      authorName: comment.authorName,
      createdAt: comment.createdAt.toISOString(),
      upvotes: comment.upCount,
      downvotes: comment.downCount,
      userVote,
    };
  });

  return NextResponse.json({
    ok: true,
    comments: formattedComments,
  });
}
