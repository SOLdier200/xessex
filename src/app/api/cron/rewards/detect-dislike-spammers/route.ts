/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 *
 * POST /api/cron/rewards/detect-dislike-spammers
 *
 * Auto-detects users with 100% dislike ratio and >10 votes.
 * Applies a 3-week XESS reward hold and notifies mods.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { notifyMods, getUserDisplayString } from "@/lib/modNotifications";

export const runtime = "nodejs";

const THREE_WEEKS_MS = 21 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET || "";
  const authHeader = req.headers.get("x-cron-secret");
  if (!cronSecret || authHeader !== cronSecret) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const voteStats = await db.commentMemberVote.groupBy({
    by: ["voterId"],
    _count: { id: true },
    _sum: { value: true },
  });

  let flaggedCount = 0;
  const flaggedUsers: string[] = [];

  for (const stat of voteStats) {
    const totalVotes = stat._count.id;
    if (totalVotes <= 10) continue;

    const sum = stat._sum.value ?? 0;
    const dislikes = (totalVotes - sum) / 2;

    // Only flag if 100% dislikes
    if (dislikes !== totalVotes) continue;

    // Check if already flagged
    const user = await db.user.findUnique({
      where: { id: stat.voterId },
      select: { id: true, email: true, walletAddress: true, rewardBanStatus: true },
    });
    if (!user || user.rewardBanStatus !== "ALLOWED") continue;

    const banUntil = new Date(Date.now() + THREE_WEEKS_MS);
    const reason = `Auto-detected: 100% dislike ratio (${totalVotes} votes, all dislikes)`;

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          rewardBanStatus: "TEMP_BANNED",
          rewardBanUntil: banUntil,
          rewardBanReason: reason,
        },
      }),
      db.modAction.create({
        data: {
          modId: user.id,
          targetUserId: user.id,
          actionType: "REWARD_BAN",
          actionSubtype: "auto_dislike_spam",
          reason,
          details: JSON.stringify({ totalVotes, dislikes, banUntil: banUntil.toISOString() }),
        },
      }),
      db.userMessage.create({
        data: {
          userId: user.id,
          type: "WARNING",
          subject: "XESS Reward Hold Applied",
          body: `Your XESS token payouts have been paused for 3 weeks due to automated detection of dislike spam behavior (100% dislike ratio across ${totalVotes}+ votes). A moderator will review your account. If this was a mistake, the hold may be lifted early.`,
        },
      }),
    ]);

    notifyMods({
      type: "REWARD_HOLD_AUTO",
      targetUserId: user.id,
      targetUserDisplay: getUserDisplayString(user),
      details: `Auto reward hold: 100% dislike ratio, ${totalVotes} total votes. Hold expires ${banUntil.toISOString()}.`,
    });

    flaggedCount++;
    flaggedUsers.push(user.id);
  }

  return NextResponse.json({
    ok: true,
    flaggedCount,
    flaggedUsers,
    scannedVoters: voteStats.length,
  });
}
