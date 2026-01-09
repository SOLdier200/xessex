import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";
import { getClientIp, getUserAgent } from "@/lib/security";

export const runtime = "nodejs";

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ua = getUserAgent(req) ?? undefined;

  try {
    const { email, token, newPassword } = await req.json();

    const e = String(email ?? "").trim().toLowerCase();
    const t = String(token ?? "").trim();
    const p = String(newPassword ?? "");

    if (!e || !t || !p) {
      await db.passwordResetAttempt.create({
        data: { email: e || "", ip, userAgent: ua, action: "RESET", allowed: false, reason: "MISSING_FIELDS" },
      });
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }

    if (p.length < 5) {
      await db.passwordResetAttempt.create({
        data: { email: e, ip, userAgent: ua, action: "RESET", allowed: false, reason: "PASSWORD_TOO_SHORT" },
      });
      return NextResponse.json({ ok: false, error: "Password too short (min 5 chars)" }, { status: 400 });
    }

    // Rate limit reset submissions (prevents brute force token guessing)
    const sinceWindow = new Date(Date.now() - 15 * 60_000);
    const resetIpCount = await db.passwordResetAttempt.count({
      where: { ip, action: "RESET", createdAt: { gte: sinceWindow } },
    });
    if (resetIpCount >= 10) {
      await db.passwordResetAttempt.create({
        data: { email: e, ip, userAgent: ua, action: "RESET", allowed: false, reason: "RATE_LIMIT_RESET_IP_WINDOW" },
      });
      return NextResponse.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const user = await db.user.findUnique({ where: { email: e } });
    if (!user) {
      await db.passwordResetAttempt.create({
        data: { email: e, ip, userAgent: ua, action: "RESET", allowed: false, reason: "USER_NOT_FOUND" },
      });
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 400 });
    }

    const tokenHash = sha256(t);

    const rec = await db.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!rec || rec.userId !== user.id) {
      await db.passwordResetAttempt.create({
        data: { email: e, ip, userAgent: ua, action: "RESET", allowed: false, reason: "INVALID_TOKEN" },
      });
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 400 });
    }
    if (rec.usedAt) {
      await db.passwordResetAttempt.create({
        data: { email: e, ip, userAgent: ua, action: "RESET", allowed: false, reason: "TOKEN_ALREADY_USED" },
      });
      return NextResponse.json({ ok: false, error: "Token already used" }, { status: 400 });
    }
    if (rec.expiresAt.getTime() < Date.now()) {
      await db.passwordResetAttempt.create({
        data: { email: e, ip, userAgent: ua, action: "RESET", allowed: false, reason: "TOKEN_EXPIRED" },
      });
      return NextResponse.json({ ok: false, error: "Token expired" }, { status: 400 });
    }

    const passHash = await bcrypt.hash(p, 12);

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passHash },
      }),
      db.passwordResetToken.update({
        where: { id: rec.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate any other outstanding tokens
      db.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    // Log successful reset
    await db.passwordResetAttempt.create({
      data: { email: e, ip, userAgent: ua, action: "RESET", allowed: true, reason: "OK" },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Reset password error:", error);
    try {
      await db.passwordResetAttempt.create({
        data: { email: "", ip, userAgent: ua, action: "RESET", allowed: false, reason: "SERVER_ERROR" },
      });
    } catch {
      // Ignore logging error
    }
    return NextResponse.json({ ok: false, error: error?.message ?? "ERR" }, { status: 500 });
  }
}
