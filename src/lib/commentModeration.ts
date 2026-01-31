/**
 * Comment Moderation System
 *
 * Automatically tracks removed comments and applies warnings/bans:
 * - 3+ removed: Warning about spamming
 * - 5+ removed: 1-week suspension + additional warning
 * - 10+ removed: Permanent comment ban
 */

import { db } from "@/lib/prisma";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface ModerationResult {
  action: "none" | "warning" | "temp_ban" | "perm_ban";
  removedCount: number;
  message?: string;
}

/**
 * Check a user's removed comment count and apply appropriate action.
 * Call this after removing a comment.
 */
export async function checkAndApplyCommentModeration(userId: string): Promise<ModerationResult> {
  // Count removed comments for this user
  const removedCount = await db.comment.count({
    where: {
      authorId: userId,
      status: "REMOVED",
    },
  });

  // Get current user status
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      commentBanStatus: true,
      commentBanUntil: true,
    },
  });

  if (!user) {
    return { action: "none", removedCount };
  }

  // Already permanently banned
  if (user.commentBanStatus === "PERM_BANNED") {
    return { action: "none", removedCount };
  }

  // Check thresholds and apply appropriate action
  if (removedCount >= 10) {
    // Permanent ban
    return await applyPermanentBan(userId, removedCount);
  } else if (removedCount >= 5) {
    // Check if already temp banned for this threshold
    const existingTempBan = await db.commentWarning.findFirst({
      where: { userId, warningType: "suspension_warning_5" },
    });

    if (!existingTempBan) {
      return await applyTempBan(userId, removedCount);
    }
  } else if (removedCount >= 3) {
    // Check if already warned for this threshold
    const existingWarning = await db.commentWarning.findFirst({
      where: { userId, warningType: "spam_warning_3" },
    });

    if (!existingWarning) {
      return await applySpamWarning(userId, removedCount);
    }
  }

  return { action: "none", removedCount };
}

async function applySpamWarning(userId: string, removedCount: number): Promise<ModerationResult> {
  const message = `Warning: You have had ${removedCount} comments removed by moderators. Continued spamming or posting inappropriate content may result in your commenting ability being suspended or permanently disabled.`;

  await db.$transaction([
    db.commentWarning.create({
      data: {
        userId,
        warningType: "spam_warning_3",
        removedCount,
        message,
      },
    }),
    db.user.update({
      where: { id: userId },
      data: {
        commentBanStatus: "WARNED",
      },
    }),
  ]);

  return { action: "warning", removedCount, message };
}

async function applyTempBan(userId: string, removedCount: number): Promise<ModerationResult> {
  const expiresAt = new Date(Date.now() + ONE_WEEK_MS);
  const message = `Your commenting ability has been suspended for 1 week due to ${removedCount} removed comments. This is your final warning - if you reach 10 removed comments, your commenting ability will be permanently disabled.`;

  await db.$transaction([
    db.commentWarning.create({
      data: {
        userId,
        warningType: "suspension_warning_5",
        removedCount,
        message,
      },
    }),
    db.commentBan.create({
      data: {
        userId,
        banType: "temp_1_week",
        reason: `Automatic 1-week suspension: ${removedCount} comments removed`,
        expiresAt,
      },
    }),
    db.user.update({
      where: { id: userId },
      data: {
        commentBanStatus: "TEMP_BANNED",
        commentBanUntil: expiresAt,
        commentBanReason: `Automatic suspension: ${removedCount} comments removed by moderators`,
      },
    }),
  ]);

  return { action: "temp_ban", removedCount, message };
}

async function applyPermanentBan(userId: string, removedCount: number): Promise<ModerationResult> {
  const message = `Your commenting ability has been permanently disabled due to ${removedCount} removed comments. This action is final.`;

  await db.$transaction([
    db.commentWarning.create({
      data: {
        userId,
        warningType: "permanent_ban_10",
        removedCount,
        message,
      },
    }),
    db.commentBan.create({
      data: {
        userId,
        banType: "permanent",
        reason: `Automatic permanent ban: ${removedCount} comments removed`,
        expiresAt: null,
      },
    }),
    db.user.update({
      where: { id: userId },
      data: {
        commentBanStatus: "PERM_BANNED",
        commentBanUntil: null,
        commentBanReason: `Permanent ban: ${removedCount} comments removed by moderators`,
      },
    }),
  ]);

  return { action: "perm_ban", removedCount, message };
}

/**
 * Check if a user is currently allowed to comment.
 */
export async function canUserComment(userId: string): Promise<{ allowed: boolean; reason?: string; banExpiresAt?: Date }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      commentBanStatus: true,
      commentBanUntil: true,
      commentBanReason: true,
    },
  });

  if (!user) {
    return { allowed: false, reason: "User not found" };
  }

  // Check if temp ban has expired
  if (user.commentBanStatus === "TEMP_BANNED" && user.commentBanUntil) {
    if (new Date() > user.commentBanUntil) {
      // Ban expired, update status
      await db.user.update({
        where: { id: userId },
        data: {
          commentBanStatus: "WARNED",
          commentBanUntil: null,
        },
      });
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: user.commentBanReason || "Your commenting ability is temporarily suspended",
      banExpiresAt: user.commentBanUntil,
    };
  }

  if (user.commentBanStatus === "PERM_BANNED") {
    return {
      allowed: false,
      reason: user.commentBanReason || "Your commenting ability has been permanently disabled",
    };
  }

  return { allowed: true };
}

/**
 * Unban a user (for moderator use)
 */
export async function unbanUser(userId: string, modId: string): Promise<void> {
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: {
        commentBanStatus: "UNBANNED",
        commentBanUntil: null,
      },
    }),
    db.commentBan.updateMany({
      where: {
        userId,
        unbannedAt: null,
      },
      data: {
        unbannedAt: new Date(),
        unbannedBy: modId,
      },
    }),
  ]);
}

/**
 * Reban a previously unbanned user
 */
export async function rebanUser(userId: string, modId: string, permanent: boolean = true): Promise<void> {
  const expiresAt = permanent ? null : new Date(Date.now() + ONE_WEEK_MS);

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: {
        commentBanStatus: permanent ? "PERM_BANNED" : "TEMP_BANNED",
        commentBanUntil: expiresAt,
        commentBanReason: `Rebanned by moderator`,
      },
    }),
    db.commentBan.create({
      data: {
        userId,
        banType: permanent ? "permanent" : "temp_1_week",
        reason: "Rebanned by moderator after previous unban",
        expiresAt,
      },
    }),
  ]);
}

/**
 * Get unruly users (3+ removed comments, not yet banned)
 */
export async function getUnrulyUsers() {
  // Get users with 3+ removed comments
  const usersWithRemovedComments = await db.comment.groupBy({
    by: ["authorId"],
    where: { status: "REMOVED" },
    _count: { id: true },
    having: { id: { _count: { gte: 3 } } },
    orderBy: { _count: { id: "desc" } },
  });

  const userIds = usersWithRemovedComments.map((u) => u.authorId);

  // Get user details
  const users = await db.user.findMany({
    where: {
      id: { in: userIds },
      commentBanStatus: { in: ["ALLOWED", "WARNED"] },
    },
    select: {
      id: true,
      email: true,
      walletAddress: true,
      commentBanStatus: true,
      createdAt: true,
      commentWarnings: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Combine with counts
  return users.map((user) => {
    const countData = usersWithRemovedComments.find((u) => u.authorId === user.id);
    return {
      ...user,
      removedCommentCount: countData?._count.id || 0,
      lastWarning: user.commentWarnings[0] || null,
    };
  }).sort((a, b) => b.removedCommentCount - a.removedCommentCount);
}

/**
 * Get comment banned users (temp or perm banned, including unbanned history)
 */
export async function getCommentBannedUsers() {
  const users = await db.user.findMany({
    where: {
      commentBanStatus: { in: ["TEMP_BANNED", "PERM_BANNED", "UNBANNED"] },
    },
    select: {
      id: true,
      email: true,
      walletAddress: true,
      commentBanStatus: true,
      commentBanUntil: true,
      commentBanReason: true,
      createdAt: true,
      commentBans: {
        orderBy: { bannedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get removed comment counts
  const userIds = users.map((u) => u.id);
  const removedCounts = await db.comment.groupBy({
    by: ["authorId"],
    where: { authorId: { in: userIds }, status: "REMOVED" },
    _count: { id: true },
  });

  const countMap = new Map(removedCounts.map((c) => [c.authorId, c._count.id]));

  return users.map((user) => ({
    ...user,
    removedCommentCount: countMap.get(user.id) || 0,
    latestBan: user.commentBans[0] || null,
  }));
}
