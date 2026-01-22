/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { db } from "@/lib/prisma";
import { createSession, getCurrentUser } from "@/lib/auth";
import { setSessionCookie } from "@/lib/authCookies";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  try {
    const { wallet, message, signature } = await req.json();

    const w = String(wallet ?? "").trim();
    const m = String(message ?? "");
    const s = String(signature ?? "");

    if (!w || !m || !s) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400, headers: noCache });
    }

    const pubkeyBytes = bs58.decode(w);
    const sigBytes = bs58.decode(s);
    const msgBytes = new TextEncoder().encode(m);

    const ok = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
    if (!ok) return NextResponse.json({ ok: false, error: "Bad signature" }, { status: 401, headers: noCache });

    // Check if user is already logged in with a different account
    const currentUser = await getCurrentUser();
    if (currentUser) {
      const alreadyKnown =
        currentUser.walletAddress === w || currentUser.solWallet === w;

      if (!alreadyKnown) {
        // Don't silently create a new wallet-native account
        // Let UI offer "Link wallet" or "Switch account"
        return NextResponse.json(
          { ok: false, error: "WALLET_NOT_LINKED", wallet: w },
          { status: 409, headers: noCache }
        );
      }
    }

    // Create or fetch wallet user (email fields stay null)
    const user = await db.user.upsert({
      where: { walletAddress: w },
      update: {},
      create: { walletAddress: w },
      select: { id: true, email: true, solWallet: true },
    });

    // Auto-backfill solWallet for wallet-native users (no email, solWallet is null)
    // This makes them payout-eligible immediately
    if (!user.email && !user.solWallet) {
      await db.user.update({
        where: { id: user.id },
        data: { solWallet: w, solWalletLinkedAt: new Date() },
      }).catch(() => {});
    }

    // Ensure 1:1 subscription row exists (helps NOWPayments upsert & access checks)
    await db.subscription
      .create({
        data: { userId: user.id, tier: "MEMBER", status: "PENDING", expiresAt: null },
      })
      .catch(() => {});

    // Create session using shared helper (TTL from env)
    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);

    return NextResponse.json({ ok: true }, { headers: noCache });
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json({ ok: false, error: "Verify failed" }, { status: 500, headers: noCache });
  }
}
