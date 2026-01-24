/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRawToken, hashToken, addMinutes } from "@/lib/tokens";
import { sendDiamondRecoveryEmailVerify } from "@/lib/email";

export const runtime = "nodejs";

const noCache = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTH" },
        { status: 401, headers: noCache }
      );
    }

    // Diamond-only
    const sub = user.subscription;
    const tier = sub?.tier;
    const status = sub?.status;
    if (
      tier !== "DIAMOND" ||
      !status ||
      !["ACTIVE", "PENDING", "PARTIAL"].includes(status)
    ) {
      return NextResponse.json(
        { ok: false, error: "NOT_DIAMOND" },
        { status: 403, headers: noCache }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "BAD_EMAIL" },
        { status: 400, headers: noCache }
      );
    }

    // Must have an auth wallet to be a "real" diamond identity
    if (!user.walletAddress) {
      return NextResponse.json(
        { ok: false, error: "NO_DIAMOND_WALLET" },
        { status: 409, headers: noCache }
      );
    }

    // Check if email is already used by another user
    const existingUser = await db.user.findFirst({
      where: {
        recoveryEmail: email,
        id: { not: user.id },
      },
    });
    if (existingUser) {
      return NextResponse.json(
        { ok: false, error: "EMAIL_IN_USE" },
        { status: 409, headers: noCache }
      );
    }

    // Store as pending (unverified)
    await db.user.update({
      where: { id: user.id },
      data: { recoveryEmail: email, recoveryEmailVerifiedAt: null },
    });

    // Create a short-lived verify token
    const raw = makeRawToken();
    const tokenHash = hashToken(raw);
    const expiresAt = addMinutes(30);

    await db.diamondToken.create({
      data: {
        userId: user.id,
        kind: "VERIFY_EMAIL",
        tokenHash,
        expiresAt,
        requestIp:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        requestUa: req.headers.get("user-agent") || null,
      },
    });

    const siteUrl = process.env.SITE_URL || "http://localhost:3000";
    const verifyUrl = `${siteUrl}/diamond/verify-recovery-email?token=${raw}`;

    await sendDiamondRecoveryEmailVerify(email, verifyUrl);

    return NextResponse.json({ ok: true }, { headers: noCache });
  } catch (err) {
    console.error("recovery-email/request error:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500, headers: noCache }
    );
  }
}
