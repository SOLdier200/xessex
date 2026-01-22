import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { setSessionCookie } from "@/lib/authCookies";
import { generateReferralCode } from "@/lib/referral";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email().max(254),
  password: z.string().min(5),
  refCode: z.string().optional().nullable(),
});

/**
 * POST /api/auth/email/register-for-checkout
 *
 * Creates an email account ONLY during checkout flow.
 * This is NOT a general signup - it's only exposed on /signup during checkout.
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

  // Look up referrer if refCode provided
  const refCode = parsed.data.refCode?.trim() || null;
  let referredById: string | null = null;
  if (refCode) {
    const referrer = await db.user.findUnique({
      where: { referralCode: refCode },
      select: { id: true },
    });
    if (referrer) {
      referredById = referrer.id;
    }
  }

  // Create user with unique referral code (retry on collision)
  let user: { id: string; email: string | null } | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      user = await db.user.create({
        data: {
          email,
          passHash,
          referralCode: generateReferralCode(),
          referredById,
          referredAt: referredById ? new Date() : null,
          // walletAddress stays null (email-only user)
        },
        select: { id: true, email: true },
      });
      break;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Retry only if unique constraint on referralCode
      if (!msg.includes("Unique constraint") || !msg.includes("referralCode")) {
        throw e;
      }
      // Continue to next attempt
    }
  }

  if (!user) {
    return NextResponse.json({ ok: false, error: "USER_CREATE_FAILED" }, { status: 500 });
  }

  // Ensure subscription row exists (1:1) - tier will be set by billing start route
  // Use findUnique + create to avoid race conditions and never swallow errors
  const existingSub = await db.subscription.findUnique({
    where: { userId: user.id },
  });

  if (!existingSub) {
    await db.subscription.create({
      data: {
        userId: user.id,
        tier: "MEMBER", // placeholder; start route will set proper tier
        status: "PENDING",
        expiresAt: null,
        paymentMethod: "CRYPTO",
      },
    });
  }

  // Create session + set cookie
  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);

  return NextResponse.json({ ok: true, user });
}
