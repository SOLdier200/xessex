/**
 * Voting Participation API
 *
 * Returns user's voting participation percentage:
 * - votesCast: Number of comments user has voted on
 * - percentage: (votesCast / totalComments) * 100
 *
 * Total comment count is cached for 5 minutes
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cache for total comment count (refreshed every 5 minutes)
let cachedTotalComments: number | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getTotalCommentCount(): Promise<number> {
  const now = Date.now();

  if (cachedTotalComments !== null && now - cacheTimestamp < CACHE_TTL) {
    return cachedTotalComments;
  }

  // Count all comments that can be voted on (active only)
  const count = await db.comment.count({
    where: {
      status: "ACTIVE",
    },
  });

  cachedTotalComments = count;
  cacheTimestamp = now;

  return count;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    // Get user's vote count (unique comments they've voted on)
    const votesCast = await db.commentMemberVote.count({
      where: {
        voterId: user.id,
      },
    });

    // Get total voteable comments
    const totalComments = await getTotalCommentCount();

    // Calculate percentage (handle division by zero)
    const percentage = totalComments > 0
      ? Math.round((votesCast / totalComments) * 10000) / 100 // 2 decimal places
      : 0;

    return NextResponse.json({
      ok: true,
      votesCast,
      percentage,
    });
  } catch (err: any) {
    console.error("[voting-participation] Error:", err);
    return NextResponse.json(
      { ok: false, error: "server_error", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
