import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { email, token, newPassword } = await req.json();

    const e = String(email ?? "").trim().toLowerCase();
    const t = String(token ?? "").trim();
    const p = String(newPassword ?? "");

    if (!e || !t || !p) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }

    if (p.length < 5) {
      return NextResponse.json({ ok: false, error: "Password too short (min 5 chars)" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email: e } });
    if (!user) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 400 });

    const tokenHash = sha256(t);

    const rec = await db.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!rec || rec.userId !== user.id) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 400 });
    }
    if (rec.usedAt) {
      return NextResponse.json({ ok: false, error: "Token already used" }, { status: 400 });
    }
    if (rec.expiresAt.getTime() < Date.now()) {
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

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Reset password error:", error);
    return NextResponse.json({ ok: false, error: error?.message ?? "ERR" }, { status: 500 });
  }
}
