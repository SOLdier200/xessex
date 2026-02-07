/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { truncWallet } from "@/lib/scoring";
import { weekKeyUTC } from "@/lib/weekKey";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";
import { poolFromVideoKind, startOfDayUTC, FLAT_RATES } from "@/lib/rewardPool";
import { canUserComment } from "@/lib/commentModeration";
import { signR2GetUrl } from "@/lib/r2";

// Force Node.js runtime (required for Prisma transactions)
export const runtime = "nodejs";

// Special credits reward for commenting
const COMMENT_CREDIT_REWARD = 2n; // 2 credits per comment (once per video)
const NEW_USER_PENDING_UNTIL_ACTIVE = 3;

const FLIP_WINDOW_MS = 60_000;

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

function keywordScreen(raw: string): {
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  reasons: Array<"SPAM" | "HARASSMENT" | "HATE" | "THREAT" | "SEXUAL_VIOLENCE" | "OTHER">;
  reasonText?: string;
} {
  const t = normalizeText(raw);

  const threat =
    /\b(kill|murder|shoot|stab|bomb|hang)\b/.test(t) ||
    (/\b(i will|im going to|ill)\b/.test(t) && /\b(kill|hurt|shoot|stab)\b/.test(t));

  const sexualViolence = /\b(rape|raping|raped|molest|molestation)\b/.test(t);
  const hate = /\b(nazi|kkk|white power)\b/.test(t);
  const spam = /\b(buy now|free crypto|visit my|http|https|www)\b/.test(t);

  const reasons: any[] = [];
  if (threat) reasons.push("THREAT");
  if (sexualViolence) reasons.push("SEXUAL_VIOLENCE");
  if (hate) reasons.push("HATE");
  if (spam) reasons.push("SPAM");

  if (threat || sexualViolence) return { decision: "BLOCK", reasons, reasonText: "keyword: severe" };
  if (reasons.length) return { decision: "REVIEW", reasons, reasonText: "keyword: review" };
  return { decision: "ALLOW", reasons: [] };
}

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
  const userId = access.user?.id ?? null;

  const comments = await db.comment.findMany({
    where: {
      videoId,
      status: access.isAdminOrMod ? { in: ["ACTIVE", "PENDING"] } : "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { walletAddress: true, email: true, profilePictureKey: true, username: true } },
      memberVotes: {
        select: {
          value: true,
          voterId: true,
          flipCount: true,
          createdAt: true, // For 60s window calculation
        },
      },
    },
  });

  const reportedSet = new Set<string>();
  if (userId && comments.length > 0) {
    const reported = await db.commentReport.findMany({
      where: {
        reporterId: userId,
        commentId: { in: comments.map((c) => c.id) },
      },
      select: { commentId: true },
    });
    for (const r of reported) reportedSet.add(r.commentId);
  }

  const now = Date.now();

  const shaped = await Promise.all(comments.map(async (c) => {
    // Use cached counters from Comment model
    const { memberLikes, memberDislikes } = c;

    const myVoteRow = userId
      ? c.memberVotes.find((v) => v.voterId === userId) ?? null
      : null;

    const userVote = myVoteRow ? myVoteRow.value : null;

    // Lock logic for this user (only)
    let voteLocked = false;
    let secondsLeftToFlip = 0;

    if (myVoteRow) {
      const windowPassed = now - myVoteRow.createdAt.getTime() > FLIP_WINDOW_MS;
      const flipUsed = (myVoteRow.flipCount ?? 0) >= 1;

      voteLocked = flipUsed || windowPassed;

      if (!voteLocked) {
        secondsLeftToFlip = Math.max(
          0,
          Math.ceil(
            (FLIP_WINDOW_MS - (now - myVoteRow.createdAt.getTime())) / 1000
          )
        );
      }
    }

    // Generate signed avatar URL if author has profile picture
    let authorAvatarUrl: string | null = null;
    if (c.author.profilePictureKey) {
      try {
        authorAvatarUrl = await signR2GetUrl(c.author.profilePictureKey, 3600);
      } catch {
        // Silent fail - avatar won't display
      }
    }

    // Use username if available, otherwise truncated wallet/email
    const authorDisplay = c.author.username || truncWallet(c.author.walletAddress, c.author.email);

    return {
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      authorId: c.authorId,
      authorWallet: authorDisplay,
      authorAvatarUrl,
      status: c.status,
      memberLikes,
      memberDislikes,
      userVote,
      voteLocked,
      secondsLeftToFlip,
      reportedByMe: reportedSet.has(c.id),
    };
  }));

  // Check if user already has a comment on this video
  const hasUserComment = userId
    ? comments.some((c) => c.authorId === userId)
    : false;

  const isAdminOrMod = !!access.isAdminOrMod;

  return NextResponse.json({
    ok: true,
    comments: shaped,
    hasUserComment,
    currentUserId: userId,
    isAdminOrMod,
  });
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

  const banCheck = await canUserComment(access.user.id);
  if (!banCheck.allowed) {
    return NextResponse.json(
      { ok: false, error: "COMMENT_BANNED", reason: banCheck.reason, until: banCheck.banExpiresAt ?? null },
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

  const bodyNormalized = normalizeText(text);
  const kw = keywordScreen(text);

  // New-user gating (based on ACTIVE comments only)
  const activeCount = await db.comment.count({
    where: { authorId: access.user.id, status: "ACTIVE" },
  });

  let status: "ACTIVE" | "PENDING" | "HIDDEN" =
    access.isAdminOrMod || activeCount >= NEW_USER_PENDING_UNTIL_ACTIVE ? "ACTIVE" : "PENDING";
  let autoReason: string | null = null;

  if (kw.decision === "BLOCK") {
    status = "HIDDEN";
    autoReason = kw.reasonText ?? "keyword: blocked";
  } else if (kw.decision === "REVIEW") {
    status = "PENDING";
    autoReason = kw.reasonText ?? "keyword: review";
  }

  const video = await db.video.findUnique({
    where: { id: videoId },
    select: { id: true, kind: true },
  });
  if (!video) {
    return NextResponse.json(
      { ok: false, error: "VIDEO_NOT_FOUND" },
      { status: 404 }
    );
  }

  const pool = poolFromVideoKind(video.kind);

  // Check if user already has a comment on this video (1 per member per video)
  const existingComment = await db.comment.findFirst({
    where: { videoId, authorId: access.user.id },
  });
  if (existingComment) {
    return NextResponse.json(
      { ok: false, error: "ALREADY_COMMENTED" },
      { status: 400 }
    );
  }

  const wk = weekKeyUTC(new Date());
  const dayUTC = startOfDayUTC(new Date());
  const userId = access.user!.id;

  // Step 1: Create comment (small, fast transaction)
  let newComment;
  try {
    newComment = await db.comment.create({
      data: {
        videoId,
        authorId: userId,
        body: text,
        bodyNormalized,
        status,
        autoReason: autoReason ?? undefined,
        memberLikes: 0,
        memberDislikes: 0,
        score: 0,
      },
      include: {
        author: { select: { walletAddress: true, email: true, profilePictureKey: true, username: true } },
      },
    });
  } catch (err) {
    console.error("[POST /api/comments] Comment creation failed:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", details: String(err) },
      { status: 500 }
    );
  }

  // Step 2: Track stats and credits (non-critical, done outside main transaction)
  // These are idempotent operations that won't break if they fail
  let creditsAwarded = 0;

  if (status === "ACTIVE") {
    try {
      // Mark daily active (idempotent upsert)
      await db.userDailyActive.upsert({
        where: { userId_day_pool: { userId, day: dayUTC, pool } },
        create: { userId, day: dayUTC, pool },
        update: {},
      });

      // Track weekly stats if comment is long enough
      console.log("[comments] wk", wk, "len", text.length, "user", userId, "pool", pool);
      if (text.length >= 7) {
        console.log("[comments] eligible -> increment diamondComments");
        await db.weeklyUserStat.upsert({
          where: { weekKey_userId_pool: { weekKey: wk, userId, pool } },
          create: {
            weekKey: wk,
            userId,
            pool,
            diamondComments: 1,
            mvmPoints: 0,
            scoreReceived: 0,
            pendingAtomic: 0n,
            paidAtomic: 0n,
          },
          update: { diamondComments: { increment: 1 } },
        });

        // Log flat-rate action (idempotent upsert)
        const commentRefId = `comment:${wk}:${userId}:${videoId}`;
        const commentAmount = FLAT_RATES[pool].COMMENT;
        await db.flatActionLedger.upsert({
          where: { refId: commentRefId },
          create: {
            refId: commentRefId,
            weekKey: wk,
            userId,
            pool,
            action: "COMMENT",
            units: 1,
            amount: commentAmount,
          },
          update: {},
        });
      } else {
        console.log("[comments] NOT eligible -> too short");
      }
    } catch (err) {
      // Non-critical - log but don't fail the request
      console.error("[comments] Stats tracking failed (non-critical):", err);
    }

    // Step 3: Award special credits (separate small transaction for atomicity)
    try {
      const creditRefId = `comment_credit_${userId}_${videoId}`;
      const existingCredit = await db.specialCreditLedger.findFirst({
        where: { refId: creditRefId },
      });

      if (!existingCredit) {
        // Use a small transaction for credits atomicity
        await db.$transaction(async (tx) => {
          await tx.specialCreditAccount.upsert({
            where: { userId },
            create: { userId, balanceMicro: 0n },
            update: {},
          });

          const rewardMicro = COMMENT_CREDIT_REWARD * CREDIT_MICRO;
          await tx.specialCreditAccount.update({
            where: { userId },
            data: { balanceMicro: { increment: rewardMicro } },
          });

          await tx.specialCreditLedger.create({
            data: {
              userId,
              weekKey: wk,
              amountMicro: rewardMicro,
              reason: "Comment reward",
              refType: "COMMENT_CREDIT",
              refId: creditRefId,
            },
          });
        }, { timeout: 10000 });

        creditsAwarded = Number(COMMENT_CREDIT_REWARD);
        console.log("[comments] Awarded", creditsAwarded, "special credits for commenting");
      }
    } catch (err) {
      // Non-critical - log but don't fail the request
      console.error("[comments] Credits award failed (non-critical):", err);
    }
  }

  const comment = { comment: newComment, creditsAwarded };

  // Step 4: Check if this is the user's 5th comment and they don't have an avatar
  // Send a friendly system message prompting them to set one
  try {
    const totalComments = await db.comment.count({
      where: { authorId: userId },
    });

    if (totalComments === 5) {
      // Check if user already has a profile picture
      const userProfile = await db.user.findUnique({
        where: { id: userId },
        select: { profilePictureKey: true },
      });

      if (!userProfile?.profilePictureKey) {
        // Check if we've already sent this message (prevent duplicates)
        const existingMessage = await db.userMessage.findFirst({
          where: {
            userId,
            type: "SYSTEM",
            subject: "Add a profile picture?",
          },
        });

        if (!existingMessage) {
          await db.userMessage.create({
            data: {
              userId,
              senderId: null,
              type: "SYSTEM",
              subject: "Add a profile picture?",
              body: `Great job! You've posted 5 comments already. Want to stand out in the community? You can add a profile picture to personalize your account!\n\n[AVATAR_PROMPT]\n\nYou can always set or change your avatar later from your Profile page.`,
            },
          });
          console.log("[comments] Sent avatar prompt message to user:", userId);
        }
      }
    }
  } catch (err) {
    // Non-critical - log but don't fail
    console.error("[comments] Avatar prompt message failed (non-critical):", err);
  }

  // Generate avatar URL for the newly created comment
  let authorAvatarUrl: string | null = null;
  if (comment.comment.author.profilePictureKey) {
    try {
      authorAvatarUrl = await signR2GetUrl(comment.comment.author.profilePictureKey, 3600);
    } catch {
      // Silent fail
    }
  }

  // Use username if available, otherwise truncated wallet/email
  const authorDisplay = comment.comment.author.username || truncWallet(comment.comment.author.walletAddress, comment.comment.author.email);

  return NextResponse.json({
    ok: true,
    comment: {
      id: comment.comment.id,
      body: comment.comment.body,
      createdAt: comment.comment.createdAt.toISOString(),
      authorId: comment.comment.authorId,
      authorWallet: authorDisplay,
      authorAvatarUrl,
      memberLikes: 0,
      memberDislikes: 0,
      userVote: null,
      voteLocked: false,
      secondsLeftToFlip: 0,
      status: comment.comment.status,
    },
    creditsEarned: comment.creditsAwarded,
  });
}
