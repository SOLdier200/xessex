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
 * POST /api/auth/email/register-for-checkout
 *
 * Creates an email account ONLY during checkout flow.
 * This is NOT a general signup - it's only exposed on /subscribe.
 * User starts with PENDING subscription until payment completes.
 */
export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const password = parsed.data.password;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ ok: false, error: "EMAIL_EXISTS" }, { status: 409 });
  }

  const passHash = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: {
      email,
      passHash,
      // walletAddress stays null (email-only user)
    },
    select: { id: true, email: true },
  });

  // Ensure subscription row exists (1:1) - tier will be set by billing start route
  await db.subscription.create({
    data: {
      userId: user.id,
      tier: "MEMBER", // placeholder; start route will set proper tier
      status: "PENDING",
      expiresAt: null,
    },
  }).catch(() => {});

  // Create session + set cookie
  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);

  return NextResponse.json({ ok: true, user });
}
