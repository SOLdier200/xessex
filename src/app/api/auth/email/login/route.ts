import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { setSessionCookie } from "@/lib/authCookies";

export const runtime = "nodejs";

// Rate limiting: 5 attempts per minute per IP
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  // Clean up expired records periodically
  if (loginAttempts.size > 10000) {
    for (const [key, val] of loginAttempts) {
      if (val.resetAt < now) loginAttempts.delete(key);
    }
  }

  if (!record || record.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }

  record.count++;
  return { allowed: true };
}

const Body = z.object({
  email: z.string().email().max(254),
  password: z.string().min(5),
});

/**
 * POST /api/auth/email/login
 *
 * Log in with email/password and create session.
 * Rate limited to 5 attempts per minute per IP.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(ip);

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED", retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const password = parsed.data.password;

  const user = await db.user.findUnique({
    where: { email },
    include: { subscription: true },
  });

  if (!user?.passHash) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passHash);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "INVALID_PASSWORD" }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);

  // Determine membership for UI feedback
  const sub = user.subscription;
  const active = !!sub && sub.status === "ACTIVE" && (!sub.expiresAt || sub.expiresAt > new Date());

  const membership =
    active && sub?.tier === "DIAMOND" ? "DIAMOND" :
    active ? "MEMBER" : "FREE";

  return NextResponse.json({ ok: true, membership });
}
