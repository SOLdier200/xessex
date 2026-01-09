import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const e = String(email ?? "").trim().toLowerCase();

    // Always return ok (prevents account enumeration)
    if (!e) return NextResponse.json({ ok: true });

    // If user doesn't exist or has no email login, still return ok
    const user = await db.user.findUnique({ where: { email: e } });
    if (!user || !user.email) return NextResponse.json({ ok: true });

    // Clear prior unused tokens
    await db.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
    if (!baseUrl) throw new Error("Missing NEXT_PUBLIC_APP_URL (or APP_URL)");

    const resetLink = `${baseUrl}/reset-password?email=${encodeURIComponent(e)}&token=${rawToken}`;

    // Send email via Resend
    await sendPasswordResetEmail(e, resetLink);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Forgot password error:", error);
    return NextResponse.json({ ok: false, error: error?.message ?? "ERR" }, { status: 500 });
  }
}
