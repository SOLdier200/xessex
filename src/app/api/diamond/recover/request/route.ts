/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { makeRawToken, hashToken, addMinutes } from "@/lib/tokens";
import { sendDiamondRecoveryEmail } from "@/lib/email";

export const runtime = "nodejs";

const noCache = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();

    // Always respond ok to prevent enumeration
    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: true }, { headers: noCache });
    }

    // Find a Diamond user with verified recovery email
    const user = await db.user.findFirst({
      where: {
        recoveryEmail: email,
        recoveryEmailVerifiedAt: { not: null },
        subscription: {
          tier: "DIAMOND",
          status: { in: ["ACTIVE", "PENDING", "PARTIAL"] },
        },
      },
      select: { id: true, walletAddress: true },
    });

    if (!user) {
      // Don't reveal if email exists
      return NextResponse.json({ ok: true }, { headers: noCache });
    }

    // Must have an existing wallet to recover from
    if (!user.walletAddress) {
      return NextResponse.json({ ok: true }, { headers: noCache });
    }

    // Create RESTORE token
    const raw = makeRawToken();
    const tokenHash = hashToken(raw);
    const expiresAt = addMinutes(30);

    await db.diamondToken.create({
      data: {
        userId: user.id,
        kind: "RESTORE",
        tokenHash,
        expiresAt,
        requestIp:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        requestUa: req.headers.get("user-agent") || null,
      },
    });

    const siteUrl = process.env.SITE_URL || "http://localhost:3000";
    const recoverUrl = `${siteUrl}/recover/confirm?token=${raw}`;

    await sendDiamondRecoveryEmail(email, recoverUrl);

    return NextResponse.json({ ok: true }, { headers: noCache });
  } catch (err) {
    console.error("recover/request error:", err);
    // Still return ok to not leak info
    return NextResponse.json({ ok: true }, { headers: noCache });
  }
}
