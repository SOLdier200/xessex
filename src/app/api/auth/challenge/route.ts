/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const COOKIE_NAME = "xessex_wallet_challenge";
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

function b64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlJson(obj: any) {
  return b64url(Buffer.from(JSON.stringify(obj), "utf8"));
}

function sign(payloadB64u: string, secret: string) {
  const sig = crypto.createHmac("sha256", secret).update(payloadB64u).digest();
  return `${payloadB64u}.${b64url(sig)}`;
}

function envSecret() {
  return (
    process.env.WALLET_CHALLENGE_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ""
  );
}

export async function POST(req: Request) {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  try {
    const { wallet, purpose, ttlMs } = await req.json().catch(() => ({} as any));

    const w = String(wallet ?? "").trim();
    if (!w) {
      return NextResponse.json({ ok: false, error: "Missing wallet" }, { status: 400, headers: noCache });
    }

    const ttl = Math.max(30_000, Math.min(Number(ttlMs ?? DEFAULT_TTL_MS), 30 * 60 * 1000)); // 30s..30m
    const now = Date.now();
    const exp = now + ttl;

    const nonce = b64url(crypto.randomBytes(24));
    const p = String(purpose ?? "LOGIN").toUpperCase();

    const issuedAtIso = new Date(now).toISOString();
    const expiresAtIso = new Date(exp).toISOString();

    const message =
      `Xessex Wallet ${p}\n` +
      `Wallet: ${w}\n` +
      `Nonce: ${nonce}\n` +
      `Issued At: ${issuedAtIso}\n` +
      `Expires At: ${expiresAtIso}`;

    const secret = envSecret();
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "Server missing WALLET_CHALLENGE_SECRET/AUTH_SECRET" },
        { status: 500, headers: noCache }
      );
    }

    const payload = b64urlJson({ w, nonce, exp, p });
    const token = sign(payload, secret);

    const res = NextResponse.json(
      { ok: true, wallet: w, purpose: p, nonce, expiresAt: expiresAtIso, message },
      { headers: noCache }
    );

    res.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(exp),
    });

    return res;
  } catch (err) {
    console.error("Challenge error:", err);
    return NextResponse.json({ ok: false, error: "Challenge failed" }, { status: 500, headers: noCache });
  }
}

export function GET() {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405, headers: noCache });
}
