import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { weekKeyUTC } from "@/lib/weekKey";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";
import { poolFromVideoKind, startOfDayUTC, FLAT_RATES } from "@/lib/rewardPool";

// Special credits reward for commenting
const COMMENT_CREDIT_REWARD = 2n;

export async function POST(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { commentId?: string } | null;
  const commentId = body?.commentId?.trim();
  if (!commentId) {
    return NextResponse.json({ ok: false, error: "MISSING_COMMENT_ID" }, { status: 400 });
  }

  const comment = await db.comment.findUnique({
    where: { id: commentId },
    include: {
      video: { select: { id: true, kind: true } },
      author: { select: { id: true } },
    },
  });

  if (!comment) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  if (comment.status !== "PENDING") {
    return NextResponse.json({ ok: false, error: "NOT_PENDING" }, { status: 400 });
  }

  const pool = poolFromVideoKind(comment.video.kind);
  const wk = weekKeyUTC(comment.createdAt);
  const dayUTC = startOfDayUTC(comment.createdAt);

  await db.$transaction(async (tx) => {
    await tx.comment.update({
      where: { id: commentId },
      data: {
        status: "ACTIVE",
        autoReason: null,
        removedAt: null,
        removedById: null,
        removedReason: null,
      },
    });

    // Mark daily active (idempotent)
    await tx.userDailyActive.upsert({
      where: { userId_day_pool: { userId: comment.authorId, day: dayUTC, pool } },
      create: { userId: comment.authorId, day: dayUTC, pool },
      update: {},
    });

    // Weekly rewards (min 7 chars quality gate)
    if (comment.body.length >= 7) {
      await tx.weeklyUserStat.upsert({
        where: { weekKey_userId_pool: { weekKey: wk, userId: comment.authorId, pool } },
        create: {
          weekKey: wk,
          userId: comment.authorId,
          pool,
          diamondComments: 1,
          mvmPoints: 0,
          scoreReceived: 0,
          pendingAtomic: 0n,
          paidAtomic: 0n,
        },
        update: { diamondComments: { increment: 1 } },
      });

      const commentRefId = `comment:${wk}:${comment.authorId}:${comment.videoId}`;
      const commentAmount = FLAT_RATES[pool].COMMENT;
      await tx.flatActionLedger.upsert({
        where: { refId: commentRefId },
        create: {
          refId: commentRefId,
          weekKey: wk,
          userId: comment.authorId,
          pool,
          action: "COMMENT",
          units: 1,
          amount: commentAmount,
        },
        update: {},
      });
    }

    // Award special credits once per video
    const creditRefId = `comment_credit_${comment.authorId}_${comment.videoId}`;
    const existingCredit = await tx.specialCreditLedger.findFirst({
      where: { refId: creditRefId },
      select: { id: true },
    });

    if (!existingCredit) {
      await tx.specialCreditAccount.upsert({
        where: { userId: comment.authorId },
        create: { userId: comment.authorId, balanceMicro: 0n },
        update: {},
      });

      const rewardMicro = COMMENT_CREDIT_REWARD * CREDIT_MICRO;
      await tx.specialCreditAccount.update({
        where: { userId: comment.authorId },
        data: { balanceMicro: { increment: rewardMicro } },
      });

      await tx.specialCreditLedger.create({
        data: {
          userId: comment.authorId,
          weekKey: wk,
          amountMicro: rewardMicro,
          reason: "Comment reward",
          refType: "COMMENT_CREDIT",
          refId: creditRefId,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
