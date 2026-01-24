/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";

export const runtime = "nodejs";

const noCache = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "MISSING_TOKEN" },
        { status: 400, headers: noCache }
      );
    }

    const tokenHash = hashToken(token);

    const rec = await db.diamondToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { subscription: true } } },
    });

    if (!rec || rec.kind !== "VERIFY_EMAIL") {
      return NextResponse.json(
        { ok: false, error: "BAD_TOKEN" },
        { status: 401, headers: noCache }
      );
    }

    if (rec.usedAt) {
      return NextResponse.json(
        { ok: false, error: "TOKEN_USED" },
        { status: 409, headers: noCache }
      );
    }

    if (rec.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: "TOKEN_EXPIRED" },
        { status: 410, headers: noCache }
      );
    }

    // Ensure this is a Diamond account (optional hardening)
    const sub = rec.user.subscription;
    if (
      !sub ||
      sub.tier !== "DIAMOND" ||
      !["ACTIVE", "PENDING", "PARTIAL"].includes(sub.status)
    ) {
      return NextResponse.json(
        { ok: false, error: "NOT_DIAMOND" },
        { status: 403, headers: noCache }
      );
    }

    await db.$transaction([
      db.diamondToken.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      }),
      db.user.update({
        where: { id: rec.userId },
        data: { recoveryEmailVerifiedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ ok: true }, { headers: noCache });
  } catch (err) {
    console.error("recovery-email/confirm error:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500, headers: noCache }
    );
  }
}
