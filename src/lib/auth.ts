/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "@/lib/prisma";
import { SubscriptionStatus } from "@prisma/client";

const COOKIE_NAME = process.env.XESSEX_SESSION_COOKIE || "xessex_session";
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

export function makeSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: {
      user: { include: { subscription: true } },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;

  return session.user;
}

export function isSubscriptionActive(
  sub?: { status: SubscriptionStatus; expiresAt: Date | null } | null
) {
  if (!sub) return false;

  // Only ACTIVE and TRIAL count as "active" subscriptions
  // PENDING/PARTIAL are transitional states (payment in progress, awaiting verification)
  // and should NOT block new trials or be treated as fully subscribed
  if (sub.status === "ACTIVE") {
    // lifetime allowed only for ACTIVE
    if (!sub.expiresAt) return true;
    return sub.expiresAt.getTime() > Date.now();
  }

  if (sub.status === "TRIAL") {
    // TRIAL must have expiresAt (14-day limit)
    if (!sub.expiresAt) return false;
    return sub.expiresAt.getTime() > Date.now();
  }

  // PENDING, PARTIAL, EXPIRED, CANCELED all return false
  return false;
}

/**
 * Check if user has any form of access (including provisional states).
 * Use this for content gating, not for blocking trial starts.
 */
export function hasSubscriptionAccess(
  sub?: { status: SubscriptionStatus; expiresAt: Date | null } | null
) {
  if (!sub) return false;

  // ACTIVE, TRIAL = fully active
  if (sub.status === "ACTIVE" || sub.status === "TRIAL") {
    if (!sub.expiresAt) return sub.status === "ACTIVE"; // lifetime only for ACTIVE
    return sub.expiresAt.getTime() > Date.now();
  }

  // PENDING = payment in progress, grant provisional access ONLY if expiry is set
  // PENDING with null expiry is just a placeholder (no access yet)
  if (sub.status === "PENDING") {
    if (!sub.expiresAt) return false; // placeholder subscription, no access
    return sub.expiresAt.getTime() > Date.now();
  }

  // PARTIAL = manual/provisional access (must have expiresAt)
  if (sub.status === "PARTIAL") {
    if (!sub.expiresAt) return false;
    return sub.expiresAt.getTime() > Date.now();
  }

  return false;
}

/**
 * Check if user's trial is currently active (convenience helper)
 */
export function isTrialActive(
  user?: { trialEndsAt: Date | null } | null
): boolean {
  if (!user?.trialEndsAt) return false;
  return user.trialEndsAt.getTime() > Date.now();
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export function requireAdminOrMod(user: { role: string }) {
  if (user.role !== "ADMIN" && user.role !== "MOD") {
    throw new Error("FORBIDDEN");
  }
}

export async function createSession(userId: string) {
  const token = makeSessionToken();
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return { token, expiresAt };
}
