/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { db } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { setSessionCookie } from "@/lib/authCookies";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { wallet, message, signature } = await req.json();

    const w = String(wallet ?? "").trim();
    const m = String(message ?? "");
    const s = String(signature ?? "");

    if (!w || !m || !s) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }

    const pubkeyBytes = bs58.decode(w);
    const sigBytes = bs58.decode(s);
    const msgBytes = new TextEncoder().encode(m);

    const ok = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
    if (!ok) return NextResponse.json({ ok: false, error: "Bad signature" }, { status: 401 });

    // Create or fetch wallet user (email fields stay null)
    const user = await db.user.upsert({
      where: { walletAddress: w },
      update: {},
      create: { walletAddress: w },
      select: { id: true },
    });

    // Ensure 1:1 subscription row exists (helps NOWPayments upsert & access checks)
    await db.subscription
      .create({
        data: { userId: user.id, tier: "MEMBER", status: "PENDING", expiresAt: null },
      })
      .catch(() => {});

    // Create session using shared helper (TTL from env)
    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json({ ok: false, error: "Verify failed" }, { status: 500 });
  }
}
