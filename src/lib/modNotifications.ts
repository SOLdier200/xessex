/**
 * Mod Notification System
 * Sends messages to all MOD and ADMIN users when unruly behavior is detected
 */

import { db } from "@/lib/prisma";

type NotificationType =
  | "STAR_SPAM_AUTO_BLOCK"
  | "STAR_ABUSE_WARNING"
  | "COMMENT_SPAM_WARNING"
  | "DISLIKE_SPAM_DETECTED"
  | "USER_BANNED"
  | "USER_UNBANNED"
  | "REWARD_HOLD_AUTO"
  | "GLOBAL_BAN"
  | "CLAIM_FREEZE";

interface NotifyModsOptions {
  type: NotificationType;
  targetUserId: string;
  targetUserDisplay: string; // email, wallet, or id snippet
  details?: string;
}

const MOD_DASHBOARD_URL = "/mod";

function getNotificationContent(opts: NotifyModsOptions): { subject: string; body: string } {
  const { type, targetUserDisplay, details } = opts;

  switch (type) {
    case "STAR_SPAM_AUTO_BLOCK":
      return {
        subject: "⚠️ Star Spam Auto-Block Triggered",
        body: `A user has been automatically blocked for star rating spam.\n\nUser: ${targetUserDisplay}\n${details || ""}\n\nThis user gave 10+ videos a 1-star rating within 10 minutes and has been automatically blocked from rating. Please review and take appropriate action.\n\nReview in Mod Dashboard: ${MOD_DASHBOARD_URL}`,
      };

    case "STAR_ABUSE_WARNING":
      return {
        subject: "Star Abuse Warning Issued",
        body: `A star abuse warning has been issued to a user.\n\nUser: ${targetUserDisplay}\n${details || ""}\n\nReview in Mod Dashboard: ${MOD_DASHBOARD_URL}`,
      };

    case "COMMENT_SPAM_WARNING":
      return {
        subject: "Comment Spam Warning Issued",
        body: `A comment spam warning has been issued to a user.\n\nUser: ${targetUserDisplay}\n${details || ""}\n\nReview in Mod Dashboard: ${MOD_DASHBOARD_URL}`,
      };

    case "DISLIKE_SPAM_DETECTED":
      return {
        subject: "Dislike Spam Pattern Detected",
        body: `A user has been flagged for excessive dislike voting.\n\nUser: ${targetUserDisplay}\n${details || ""}\n\nReview in Mod Dashboard: ${MOD_DASHBOARD_URL}`,
      };

    case "USER_BANNED":
      return {
        subject: "User Ban Action Taken",
        body: `A user has been banned.\n\nUser: ${targetUserDisplay}\n${details || ""}\n\nReview in Mod Dashboard: ${MOD_DASHBOARD_URL}`,
      };

    case "USER_UNBANNED":
      return {
        subject: "User Unban Action Taken",
        body: `A user has been unbanned.\n\nUser: ${targetUserDisplay}\n${details || ""}\n\nReview in Mod Dashboard: ${MOD_DASHBOARD_URL}`,
      };

    case "REWARD_HOLD_AUTO":
      return {
        subject: "Auto Reward Hold — Dislike Spam Detected",
        body: `A user's XESS payouts have been automatically held for 3 weeks due to 100% dislike voting.\n\nUser: ${targetUserDisplay}\n${details || ""}\n\nPlease review and decide whether to reinstate, extend, or escalate.\n\nReview in Mod Dashboard: ${MOD_DASHBOARD_URL}`,
      };

    case "GLOBAL_BAN":
      return {
        subject: "Global Ban Issued",
        body: `A user has been permanently banned from the platform.\n\nUser: ${targetUserDisplay}\n${details || ""}\n\nReview in Mod Dashboard: ${MOD_DASHBOARD_URL}`,
      };

    case "CLAIM_FREEZE":
      return {
        subject: "Claim Freeze Applied",
        body: `A user's claim button has been frozen.\n\nUser: ${targetUserDisplay}\n${details || ""}\n\nReview in Mod Dashboard: ${MOD_DASHBOARD_URL}`,
      };

    default:
      return {
        subject: "Mod Alert",
        body: `An event requires your attention.\n\nUser: ${targetUserDisplay}\n${details || ""}\n\nReview in Mod Dashboard: ${MOD_DASHBOARD_URL}`,
      };
  }
}

/**
 * Notify all MOD and ADMIN users about an event
 */
export async function notifyMods(opts: NotifyModsOptions): Promise<void> {
  try {
    // Get all mods and admins
    const mods = await db.user.findMany({
      where: {
        role: { in: ["MOD", "ADMIN"] },
      },
      select: { id: true },
    });

    if (mods.length === 0) {
      console.log("[modNotifications] No mods/admins found to notify");
      return;
    }

    const { subject, body } = getNotificationContent(opts);

    // Create messages for all mods
    await db.userMessage.createMany({
      data: mods.map((mod) => ({
        userId: mod.id,
        type: "SYSTEM" as const,
        subject,
        body,
      })),
    });

    console.log(`[modNotifications] Notified ${mods.length} mod(s) about ${opts.type} for user ${opts.targetUserId}`);
  } catch (error) {
    // Don't throw - notification failure shouldn't break the main flow
    console.error("[modNotifications] Failed to notify mods:", error);
  }
}

/**
 * Get a display string for a user (email > wallet > id)
 */
export function getUserDisplayString(user: {
  email?: string | null;
  walletAddress?: string | null;
  id: string;
}): string {
  if (user.email) return user.email;
  if (user.walletAddress) return `${user.walletAddress.slice(0, 4)}...${user.walletAddress.slice(-4)}`;
  return user.id.slice(0, 12) + "...";
}
