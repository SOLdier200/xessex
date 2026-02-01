/**
 * Recovery Email API
 *
 * POST /api/auth/recovery-email
 * Set or update the user's recovery email for account recovery
 *
 * Body: { email: string }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { createRecoveryEmailToken, getSiteUrl } from "@/lib/recoveryEmail";
import { sendRecoveryEmailVerify } from "@/lib/email";

export const runtime = "nodejs";

// Basic email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(req: Request) {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  const access = await getAccessContext();
  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: noCache });
  }

  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ ok: false, error: "EMAIL_REQUIRED" }, { status: 400, headers: noCache });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "INVALID_EMAIL" }, { status: 400, headers: noCache });
    }

    // Check if this recovery email is already used by another user
    const existing = await db.user.findFirst({
      where: {
        recoveryEmail: email,
        id: { not: access.user.id },
      },
    });

    if (existing) {
      return NextResponse.json({ ok: false, error: "EMAIL_ALREADY_USED" }, { status: 409, headers: noCache });
    }

    const current = await db.user.findUnique({
      where: { id: access.user.id },
      select: { recoveryEmail: true, recoveryEmailVerifiedAt: true },
    });

    const emailChanged = current?.recoveryEmail !== email;

    // Update user's recovery email (reset verification when email changes)
    if (emailChanged) {
      await db.user.update({
        where: { id: access.user.id },
        data: {
          recoveryEmail: email,
          recoveryEmailVerifiedAt: null,
        },
      });
    }

    // If already verified for same email, return ok without sending
    if (!emailChanged && current?.recoveryEmailVerifiedAt) {
      return NextResponse.json({ ok: true, alreadyVerified: true }, { headers: noCache });
    }

    // Send verification email
    const token = createRecoveryEmailToken({ userId: access.user.id, email });
    const verifyLink = `${getSiteUrl()}/auth/recovery-email/verify?token=${encodeURIComponent(token)}`;
    await sendRecoveryEmailVerify(email, verifyLink);

    return NextResponse.json({ ok: true, verificationSent: true }, { headers: noCache });
  } catch (err) {
    console.error("Recovery email error:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, headers: noCache });
  }
}

export async function DELETE(req: Request) {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  const access = await getAccessContext();
  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: noCache });
  }

  try {
    await db.user.update({
      where: { id: access.user.id },
      data: {
        recoveryEmail: null,
        recoveryEmailVerifiedAt: null,
      },
    });

    return NextResponse.json({ ok: true }, { headers: noCache });
  } catch (err) {
    console.error("Recovery email delete error:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, headers: noCache });
  }
}
