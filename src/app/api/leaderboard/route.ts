import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { computeCommentScore, truncWallet } from "@/lib/scoring";

/**
 * GET /api/leaderboard
 * Public leaderboard data
 * - MVM: number of comments used in VideoScoreAdjustment
 * - Karat Kruncher: most member likes on their comments
 * - Rewards: most XESS earned (stub)
 * - Referrals: most referrals (stub)
 */
export async function GET() {
  // MVM: comments used in VideoScoreAdjustment, grouped by author
  const utilized = await db.videoScoreAdjustment.findMany({
    include: { comment: true },
  });

  const utilizedByAuthor = new Map<string, number>();
  for (const u of utilized) {
    utilizedByAuthor.set(
      u.comment.authorId,
      (utilizedByAuthor.get(u.comment.authorId) ?? 0) + 1
    );
  }

  const mvmUsers = await db.user.findMany({
    where: { id: { in: [...utilizedByAuthor.keys()] } },
    select: { id: true, walletAddress: true },
  });

  const mvm = mvmUsers
    .map((u) => ({
      user: truncWallet(u.walletAddress),
      utilizedComments: utilizedByAuthor.get(u.id) ?? 0,
    }))
    .sort((a, b) => b.utilizedComments - a.utilizedComments)
    .slice(0, 50);

  // Karat Kruncher: most member likes on their comments
  const comments = await db.comment.findMany({
    where: { status: "ACTIVE" },
    include: {
      author: true,
      memberVotes: true,
      modVotes: true,
    },
  });

  const likesByAuthor = new Map<string, number>();
  const scoreByAuthor = new Map<string, number>();

  for (const c of comments) {
    const memberLikes = c.memberVotes.filter((v) => v.value === 1).length;
    const memberDislikes = c.memberVotes.filter((v) => v.value === -1).length;
    const modLikes = c.modVotes.filter((v) => v.value === 1).length;
    const modDislikes = c.modVotes.filter((v) => v.value === -1).length;

    likesByAuthor.set(
      c.authorId,
      (likesByAuthor.get(c.authorId) ?? 0) + memberLikes
    );

    const score = computeCommentScore({
      memberLikes,
      memberDislikes,
      modLikes,
      modDislikes,
    });
    scoreByAuthor.set(c.authorId, (scoreByAuthor.get(c.authorId) ?? 0) + score);
  }

  const karatUsers = await db.user.findMany({
    where: { id: { in: [...likesByAuthor.keys()] } },
    select: { id: true, walletAddress: true },
  });

  const karat = karatUsers
    .map((u) => ({
      user: truncWallet(u.walletAddress),
      memberLikes: likesByAuthor.get(u.id) ?? 0,
    }))
    .sort((a, b) => b.memberLikes - a.memberLikes)
    .slice(0, 50);

  // Rewards + Referrals are stubs until ledgers exist
  const rewards: { user: string; xessEarned: number }[] = [];
  const referrals: { user: string; referralCount: number }[] = [];

  return NextResponse.json({
    ok: true,
    mvm,
    karat,
    rewards,
    referrals,
  });
}
