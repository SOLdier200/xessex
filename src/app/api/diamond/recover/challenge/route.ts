/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { hashToken, makeNonce, addMinutes } from "@/lib/tokens";

export const runtime = "nodejs";

const noCache = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    const newWallet = String(body.newWallet ?? "").trim();

    if (!token || !newWallet) {
      return NextResponse.json(
        { ok: false, error: "MISSING_FIELDS" },
        { status: 400, headers: noCache }
      );
    }

    const tokenHash = hashToken(token);

    const rec = await db.diamondToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { subscription: true } } },
    });

    if (!rec || rec.kind !== "RESTORE") {
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

    const user = rec.user;
    const sub = user.subscription;
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

    const oldWallet = user.walletAddress;
    if (!oldWallet) {
      return NextResponse.json(
        { ok: false, error: "NO_OLD_WALLET" },
        { status: 409, headers: noCache }
      );
    }

    // Pre-check: new wallet not already in use by different user
    const existing = await db.user.findFirst({
      where: { walletAddress: newWallet },
      select: { id: true },
    });
    if (existing && existing.id !== user.id) {
      return NextResponse.json(
        { ok: false, error: "NEW_WALLET_IN_USE" },
        { status: 409, headers: noCache }
      );
    }

    // Cleanup old expired unused challenges for this user (keeps DB clean)
    await db.walletLinkChallenge.deleteMany({
      where: { userId: user.id, usedAt: null, expiresAt: { lt: new Date() } },
    });

    const nonce = makeNonce();
    const expiresAt = addMinutes(10);

    const message =
      `Xessex Diamond Recovery\n` +
      `User: ${user.id}\n` +
      `OldWallet: ${oldWallet}\n` +
      `NewWallet: ${newWallet}\n` +
      `Nonce: ${nonce}\n` +
      `Expires: ${expiresAt.toISOString()}\n` +
      `Purpose: Restore Diamond membership to a new wallet. No blockchain transaction.`;

    // Store the challenge using the existing WalletLinkChallenge table
    await db.walletLinkChallenge.create({
      data: {
        userId: user.id,
        nonce,
        message,
        expiresAt,
        purpose: "AUTH_LINK",
      },
    });

    return NextResponse.json(
      { ok: true, message, nonce, expiresAt },
      { headers: noCache }
    );
  } catch (err) {
    console.error("recover/challenge error:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500, headers: noCache }
    );
  }
}
