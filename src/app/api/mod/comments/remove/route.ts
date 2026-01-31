import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { checkAndApplyCommentModeration } from "@/lib/commentModeration";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";
import { weekKeyUTC } from "@/lib/weekKey";

// Credits to deduct when comment is removed (same as reward amount)
const COMMENT_CREDIT_PENALTY = 2n;

/**
 * POST /api/mod/comments/remove
 * Admin/Mod remove comment (sets status=REMOVED, never hard delete)
 * Also deducts special credits and applies moderation actions
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
    reason?: string;
  } | null;

  const commentId = body?.commentId?.trim();
  const reason = body?.reason?.trim() || "removed";

  if (!commentId) {
    return NextResponse.json(
      { ok: false, error: "MISSING_COMMENT_ID" },
      { status: 400 }
    );
  }

  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 }
    );
  }

  // Already removed
  if (comment.status === "REMOVED") {
    return NextResponse.json(
      { ok: false, error: "ALREADY_REMOVED" },
      { status: 400 }
    );
  }

  const wk = weekKeyUTC(new Date());

  // Transaction: remove comment, deduct credits, record penalty
  const result = await db.$transaction(async (tx) => {
    // Set status to REMOVED
    const updated = await tx.comment.update({
      where: { id: commentId },
      data: {
        status: "REMOVED",
        removedById: access.user!.id,
        removedAt: new Date(),
        removedReason: reason,
      },
    });

    // Deduct special credits from author (can go negative)
    const penaltyMicro = COMMENT_CREDIT_PENALTY * CREDIT_MICRO;

    // Ensure user has a credit account
    await tx.specialCreditAccount.upsert({
      where: { userId: comment.authorId },
      create: { userId: comment.authorId, balanceMicro: -penaltyMicro },
      update: { balanceMicro: { decrement: penaltyMicro } },
    });

    // Record penalty in ledger
    const penaltyRefId = `comment_removed_${commentId}`;
    await tx.specialCreditLedger.create({
      data: {
        userId: comment.authorId,
        weekKey: wk,
        amountMicro: -penaltyMicro,
        reason: `Comment removed: ${reason}`,
        refType: "COMMENT_REMOVED_PENALTY",
        refId: penaltyRefId,
      },
    });

    console.log(`[mod/comments/remove] Deducted ${COMMENT_CREDIT_PENALTY} credits from user ${comment.authorId}`);

    return updated;
  });

  // Apply moderation actions (warnings/bans) based on removed count
  const moderation = await checkAndApplyCommentModeration(comment.authorId);

  console.log(`[mod/comments/remove] Comment ${commentId} removed by ${access.user.id}. Moderation action: ${moderation.action}`);

  return NextResponse.json({
    ok: true,
    comment: result,
    moderation: {
      action: moderation.action,
      removedCount: moderation.removedCount,
      message: moderation.message,
    },
  });
}
