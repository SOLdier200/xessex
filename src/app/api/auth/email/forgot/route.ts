import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { getClientIp, getUserAgent } from "@/lib/security";

export const runtime = "nodejs";

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// Rate limits (tune as needed)
const WINDOW_MIN = 15;
const MAX_IP_PER_WINDOW = 5;      // 5 reset requests per IP per 15 min
const MAX_EMAIL_PER_WINDOW = 3;   // 3 per email per 15 min
const MAX_IP_PER_DAY = 30;        // Hard daily cap per IP

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ua = getUserAgent(req) ?? undefined;

  try {
    const { email } = await req.json();
    const e = String(email ?? "").trim().toLowerCase();

    // Always respond ok (prevents account enumeration)
    if (!e) {
      await db.passwordResetAttempt.create({
        data: { email: "", ip, userAgent: ua, action: "REQUEST", allowed: false, reason: "MISSING_EMAIL" },
      });
      return NextResponse.json({ ok: true });
    }

    const now = Date.now();
    const sinceWindow = new Date(now - WINDOW_MIN * 60_000);
    const sinceDay = new Date(now - 24 * 60 * 60_000);

    const [ipWindowCount, emailWindowCount, ipDayCount] = await Promise.all([
      db.passwordResetAttempt.count({ where: { ip, action: "REQUEST", createdAt: { gte: sinceWindow } } }),
      db.passwordResetAttempt.count({ where: { email: e, action: "REQUEST", createdAt: { gte: sinceWindow } } }),
      db.passwordResetAttempt.count({ where: { ip, action: "REQUEST", createdAt: { gte: sinceDay } } }),
    ]);

    // Check rate limits
    if (ipWindowCount >= MAX_IP_PER_WINDOW) {
      await db.passwordResetAttempt.create({
        data: { email: e, ip, userAgent: ua, action: "REQUEST", allowed: false, reason: "RATE_LIMIT_IP_WINDOW" },
      });
      return NextResponse.json({ ok: true }); // Still generic response
    }

    if (emailWindowCount >= MAX_EMAIL_PER_WINDOW) {
      await db.passwordResetAttempt.create({
        data: { email: e, ip, userAgent: ua, action: "REQUEST", allowed: false, reason: "RATE_LIMIT_EMAIL_WINDOW" },
      });
      return NextResponse.json({ ok: true });
    }

    if (ipDayCount >= MAX_IP_PER_DAY) {
      await db.passwordResetAttempt.create({
        data: { email: e, ip, userAgent: ua, action: "REQUEST", allowed: false, reason: "RATE_LIMIT_IP_DAY" },
      });
      return NextResponse.json({ ok: true });
    }

    // Allowed attempt (log it)
    await db.passwordResetAttempt.create({
      data: { email: e, ip, userAgent: ua, action: "REQUEST", allowed: true, reason: "OK" },
    });

    const user = await db.user.findUnique({ where: { email: e } });
    if (!user || !user.email) {
      // Still ok, no enumeration
      return NextResponse.json({ ok: true });
    }

    // Clear unused tokens for this user
    await db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60_000);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
    if (!baseUrl) throw new Error("Missing NEXT_PUBLIC_APP_URL (or APP_URL)");

    const resetLink = `${baseUrl}/reset-password?email=${encodeURIComponent(e)}&token=${rawToken}`;

    // Create token record first
    const tokenRec = await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Send email, then store resend id
    const sent = await sendPasswordResetEmail(e, resetLink);
    if (sent?.id) {
      await db.passwordResetToken.update({
        where: { id: tokenRec.id },
        data: { resendEmailId: sent.id },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    // Log error attempt too (still generic response)
    try {
      await db.passwordResetAttempt.create({
        data: { email: "", ip, userAgent: ua, action: "REQUEST", allowed: false, reason: "SERVER_ERROR" },
      });
    } catch {
      // Ignore logging error
    }
    console.error("Forgot password error:", err);
    return NextResponse.json({ ok: true });
  }
}
