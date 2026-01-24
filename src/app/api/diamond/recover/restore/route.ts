/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { hashToken } from "@/lib/tokens";

export const runtime = "nodejs";

const noCache = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    const wallet = String(body.wallet ?? "").trim(); // new wallet
    const signature = String(body.signature ?? "").trim();
    const nonce = String(body.nonce ?? "").trim();

    if (!token || !wallet || !signature || !nonce) {
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

    // Fetch stored challenge
    const ch = await db.walletLinkChallenge.findUnique({ where: { nonce } });
    if (!ch || ch.userId !== user.id) {
      return NextResponse.json(
        { ok: false, error: "INVALID_CHALLENGE" },
        { status: 400, headers: noCache }
      );
    }

    if (ch.usedAt) {
      return NextResponse.json(
        { ok: false, error: "CHALLENGE_USED" },
        { status: 409, headers: noCache }
      );
    }

    if (new Date() > ch.expiresAt) {
      return NextResponse.json(
        { ok: false, error: "CHALLENGE_EXPIRED" },
        { status: 410, headers: noCache }
      );
    }

    // Verify signature against stored message and provided wallet pubkey
    const pubkeyBytes = bs58.decode(wallet);
    const sigBytes = bs58.decode(signature);
    const msgBytes = new TextEncoder().encode(ch.message);

    const ok = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "BAD_SIGNATURE" },
        { status: 401, headers: noCache }
      );
    }

    // Prevent wallet collisions
    const existing = await db.user.findFirst({
      where: { walletAddress: wallet },
      select: { id: true },
    });
    if (existing && existing.id !== user.id) {
      return NextResponse.json(
        { ok: false, error: "NEW_WALLET_IN_USE" },
        { status: 409, headers: noCache }
      );
    }

    // Atomically: update wallet, mark challenge used, mark token used
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          walletAddress: wallet,
          solWallet: wallet,
          solWalletLinkedAt: new Date(),
        },
      }),
      db.walletLinkChallenge.update({
        where: { nonce },
        data: { usedAt: new Date() },
      }),
      db.diamondToken.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ ok: true, wallet }, { headers: noCache });
  } catch (err) {
    console.error("recover/restore error:", err);
    return NextResponse.json(
      { ok: false, error: "RESTORE_FAILED" },
      { status: 500, headers: noCache }
    );
  }
}
