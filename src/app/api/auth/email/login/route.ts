import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { setSessionCookie } from "@/lib/authCookies";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email().max(254),
  password: z.string().min(5),
});

/**
 * POST /api/auth/email/login
 *
 * Log in with email/password and create session.
 */
export async function POST(req: NextRequest) {
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
    return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passHash);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
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
