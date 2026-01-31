/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 *
 * POST /api/auth/diamond/verify-and-start
 *
 * Combined endpoint for iOS reliability: verifies wallet signature AND starts session
 * in one request. This avoids the cookie-drop issue on iOS in-app browsers where the session
 * cookie from /api/auth/verify doesn't stick before other calls are made.
 *
 * Flow: challenge → sign → verify-and-start (one response sets cookie)
 */

import { NextResponse } from "next/server";
import bs58 from "bs58";
import nacl from "tweetnacl";
import crypto from "crypto";
import { db } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { setSessionCookieOnResponse, clearCookieOnResponse } from "@/lib/authCookies";
import { generateReferralCode } from "@/lib/referral";

export const runtime = "nodejs";

const CHALLENGE_COOKIE = "xessex_wallet_challenge";

function b64urlDecodeToString(s: string) {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64").toString("utf8");
}

function b64urlToBuf(s: string) {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function envSecret() {
  return (
    process.env.WALLET_CHALLENGE_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ""
  );
}

function verifyChallengeCookie(token: string) {
  const secret = envSecret();
  if (!secret) return { ok: false as const, error: "missing_secret" as const };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false as const, error: "bad_token" as const };

  const [payloadB64u, sigB64u] = parts;
  const expected = crypto.createHmac("sha256", secret).update(payloadB64u).digest();
  const got = b64urlToBuf(sigB64u);

  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) {
    return { ok: false as const, error: "bad_sig" as const };
  }

  const payloadStr = b64urlDecodeToString(payloadB64u);
  const payload = JSON.parse(payloadStr) as { w: string; nonce: string; exp: number; p?: string };

  return { ok: true as const, payload };
}

export async function POST(req: Request) {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };
  const host = req.headers.get("host") ?? "";

  try {
    const { wallet, message, signature, refCode } = await req.json();

    const w = String(wallet ?? "").trim();
    const m = String(message ?? "");
    const s = String(signature ?? "");
    const referralCode = typeof refCode === "string" ? refCode.trim() : null;

    if (!w || !m || !s) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400, headers: noCache });
    }

    // Verify challenge cookie if present
    let clearChallengeCookie = false;
    const cookieHeader = req.headers.get("cookie") || "";
    const cookieMatch = cookieHeader.match(new RegExp(`${CHALLENGE_COOKIE}=([^;]+)`));
    if (cookieMatch?.[1]) {
      const token = decodeURIComponent(cookieMatch[1]);
      const chk = verifyChallengeCookie(token);
      if (!chk.ok) {
        return NextResponse.json({ ok: false, error: "Bad challenge" }, { status: 401, headers: noCache });
      }

      const { w: cw, nonce, exp } = chk.payload;
      if (String(cw || "").trim() !== w) {
        return NextResponse.json({ ok: false, error: "Challenge wallet mismatch" }, { status: 401, headers: noCache });
      }

      if (!m.includes(`Nonce: ${nonce}`) && !m.includes(nonce)) {
        return NextResponse.json({ ok: false, error: "Challenge nonce mismatch" }, { status: 401, headers: noCache });
      }

      if (Date.now() > Number(exp || 0)) {
        return NextResponse.json({ ok: false, error: "Challenge expired" }, { status: 401, headers: noCache });
      }

      clearChallengeCookie = true;
    }

    // Verify wallet signature
    const pubkeyBytes = bs58.decode(w);
    const sigBytes = bs58.decode(s);
    const msgBytes = new TextEncoder().encode(m);

    const sigOk = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
    if (!sigOk) {
      return NextResponse.json({ ok: false, error: "Bad signature" }, { status: 401, headers: noCache });
    }

    // Find or create user by walletAddress
    let user = await db.user.findUnique({
      where: { walletAddress: w },
      select: { id: true, walletAddress: true },
    });

    if (!user) {
      // Look up referrer if refCode provided
      let referredById: string | null = null;
      if (referralCode) {
        const referrer = await db.user.findUnique({
          where: { referralCode },
          select: { id: true },
        });
        if (referrer) {
          referredById = referrer.id;
        }
      }

      // Create new wallet user
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          user = await db.user.create({
            data: {
              walletAddress: w,
              referralCode: generateReferralCode(),
              referredById,
              referredAt: referredById ? new Date() : null,
            },
            select: { id: true, walletAddress: true },
          });
          break;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes("Unique constraint") || !msg.includes("referralCode")) {
            throw e;
          }
        }
      }
    }

    if (!user) {
      return NextResponse.json({ ok: false, error: "Failed to create user" }, { status: 500, headers: noCache });
    }

    // Create session
    const { token, expiresAt } = await createSession(user.id);

    const res = NextResponse.json(
      { ok: true },
      { headers: noCache }
    );

    setSessionCookieOnResponse(res, token, expiresAt, host);

    if (clearChallengeCookie) {
      clearCookieOnResponse(res, CHALLENGE_COOKIE, host);
    }

    return res;
  } catch (err) {
    console.error("Diamond verify-and-start error:", err);
    return NextResponse.json({ ok: false, error: "Verify failed" }, { status: 500, headers: noCache });
  }
}
