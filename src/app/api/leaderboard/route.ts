/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { RewardStatus } from "@prisma/client";
import { db } from "@/lib/prisma";
import { computeCommentScore, truncWallet } from "@/lib/scoring";

/**
 * GET /api/leaderboard
 * Public leaderboard data
 * - MVM: number of comments used in VideoScoreAdjustment
 * - Karat Kruncher: highest total comment score
 * - Rewards: most XESS earned (paid events)
 * - Referrals: most referrals
 */
export async function GET() {
  const XESS_DECIMALS = 1_000_000n;
  const toXessAmount = (atomic: bigint) => {
    const whole = atomic / XESS_DECIMALS;
    const frac = atomic % XESS_DECIMALS;
    return Number(whole) + Number(frac) / 1_000_000;
  };
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
    select: { id: true, walletAddress: true, email: true },
  });

  const mvm = mvmUsers
    .map((u) => ({
      user: truncWallet(u.walletAddress, u.email),
      utilizedComments: utilizedByAuthor.get(u.id) ?? 0,
    }))
    .sort((a, b) => b.utilizedComments - a.utilizedComments)
    .slice(0, 50);

  // Karat Kruncher: highest total comment score
  const comments = await db.comment.findMany({
    where: { status: "ACTIVE" },
    include: {
      author: true,
      memberVotes: true,
      modVotes: true,
    },
  });

  const scoreByAuthor = new Map<string, number>();

  for (const c of comments) {
    const memberLikes = c.memberVotes.filter((v) => v.value === 1).length;
    const memberDislikes = c.memberVotes.filter((v) => v.value === -1).length;
    const modLikes = c.modVotes.filter((v) => v.value === 1).length;
    const modDislikes = c.modVotes.filter((v) => v.value === -1).length;

    const score = computeCommentScore({
      memberLikes,
      memberDislikes,
      modLikes,
      modDislikes,
    });
    scoreByAuthor.set(c.authorId, (scoreByAuthor.get(c.authorId) ?? 0) + score);
  }

  const karatUsers = await db.user.findMany({
    where: { id: { in: [...scoreByAuthor.keys()] } },
    select: { id: true, walletAddress: true, email: true },
  });

  const karat = karatUsers
    .map((u) => ({
      user: truncWallet(u.walletAddress, u.email),
      totalScore: scoreByAuthor.get(u.id) ?? 0,
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 50);

  // Rewards: sum RewardEvent.amount where status = PAID
  const rewardTotals = await db.rewardEvent.groupBy({
    by: ["userId"],
    where: { status: RewardStatus.PAID },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 50,
  });

  const rewardUserIds = rewardTotals.map((r) => r.userId);
  const rewardUsers = rewardUserIds.length
    ? await db.user.findMany({
        where: { id: { in: rewardUserIds } },
        select: { id: true, walletAddress: true, email: true },
      })
    : [];

  const rewardUserMap = new Map(rewardUsers.map((u) => [u.id, u]));
  const rewards = rewardTotals.map((r) => {
    const user = rewardUserMap.get(r.userId);
    const atomic = r._sum.amount ?? 0n;
    return {
      user: user ? truncWallet(user.walletAddress, user.email) : "Anonymous",
      xessEarned: toXessAmount(atomic),
    };
  });

  // Referrals: count users where referredById = user.id
  const referralsRaw = await db.user.groupBy({
    by: ["referredById"],
    where: { referredById: { not: null } },
    _count: { _all: true },
  });

  // Sort by count descending and take top 50
  referralsRaw.sort((a, b) => b._count._all - a._count._all);
  const referralsTop50 = referralsRaw.slice(0, 50);

  const referrerIds = referralsTop50
    .map((r) => r.referredById)
    .filter((id): id is string => typeof id === "string");

  const referrers = referrerIds.length
    ? await db.user.findMany({
        where: { id: { in: referrerIds } },
        select: { id: true, walletAddress: true, email: true },
      })
    : [];

  const referrerMap = new Map(referrers.map((u) => [u.id, u]));
  const referrals = referralsTop50.map((r) => {
    const id = r.referredById as string;
    const user = referrerMap.get(id);
    return {
      user: user ? truncWallet(user.walletAddress, user.email) : "Anonymous",
      referralCount: r._count._all,
    };
  });

  return NextResponse.json({
    ok: true,
    mvm,
    karat,
    rewards,
    referrals,
  });
}
