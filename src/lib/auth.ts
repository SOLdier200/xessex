/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "@/lib/prisma";

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
      user: {
        include: {
          specialCreditAccount: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;

  // Global ban enforcement — kill session and deny access
  if (session.user.globalBanStatus === "PERM_BANNED") {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
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
