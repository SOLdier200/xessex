/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 *
 * Session Rehydration Endpoint - THE iOS FIX
 *
 * This endpoint allows re-establishing a session when cookies are lost (iOS wallet flows).
 * Client sends wallet + nonce + signature, and we verify + re-set the session cookie.
 *
 * Flow:
 * 1. Client detects wallet connected but auth says FREE
 * 2. Client calls /api/auth/wallet/nonce to get challenge
 * 3. Client signs challenge with wallet
 * 4. Client calls this endpoint with signature
 * 5. We verify signature + create session + set cookie
 */

import { NextResponse } from "next/server";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { db } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { setSessionCookieOnResponse } from "@/lib/authCookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noCache = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  Expires: "0",
};

export async function POST(req: Request) {
  try {
    const { wallet, nonce, signature } = await req.json();

    const w = String(wallet ?? "").trim();
    const n = String(nonce ?? "");
    const s = String(signature ?? "");

    if (!w || !n || !s) {
      return NextResponse.json(
        { ok: false, error: "missing_fields" },
        { status: 400, headers: noCache }
      );
    }

    // Validate nonce from DB
    const record = await db.walletNonce.findUnique({ where: { wallet: w } });
    if (!record || record.nonce !== n || record.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: "bad_or_expired_nonce" },
        { status: 400, headers: noCache }
      );
    }

    // Server-defined message (prevents replay attacks)
    const host = new URL(req.url).host;
    const message = `Rehydrate Xessex session\nHost: ${host}\nWallet: ${w}\nNonce: ${n}`;
    const msgBytes = new TextEncoder().encode(message);

    // Verify signature
    const pubkeyBytes = bs58.decode(w);
    const sigBytes = bs58.decode(s);

    const ok = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "bad_signature" },
        { status: 401, headers: noCache }
      );
    }

    // Find user by walletAddress ONLY (auth identity)
    const user = await db.user.findUnique({
      where: { walletAddress: w },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "WALLET_NOT_LINKED" },
        { status: 409, headers: noCache }
      );
    }

    // Create session
    const { token, expiresAt } = await createSession(user.id);

    // Consume nonce (prevents reuse)
    await db.walletNonce.delete({ where: { wallet: w } }).catch(() => {});

    // Return response with cookie attached directly (critical for iOS)
    const res = NextResponse.json({ ok: true }, { headers: noCache });
    setSessionCookieOnResponse(res, token, expiresAt, host);
    return res;
  } catch (err) {
    console.error("rehydrate error:", err);
    return NextResponse.json(
      { ok: false, error: "rehydrate_failed" },
      { status: 500, headers: noCache }
    );
  }
}
