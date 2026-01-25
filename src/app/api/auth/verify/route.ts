/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { db } from "@/lib/prisma";
import { createSession, getCurrentUser } from "@/lib/auth";
import { setSessionCookieOnResponse } from "@/lib/authCookies";
import { generateReferralCode } from "@/lib/referral";

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
        // Check if this wallet belongs to an existing user (e.g., Diamond member)
        // Check both walletAddress AND solWallet since Diamond members may have wallet in either field
        let existingWalletUser = await db.user.findUnique({
          where: { walletAddress: w },
          select: { id: true, subscription: { select: { tier: true, status: true } } },
        });

        // Also check solWallet if not found by walletAddress
        if (!existingWalletUser) {
          existingWalletUser = await db.user.findFirst({
            where: { solWallet: w },
            select: { id: true, subscription: { select: { tier: true, status: true } } },
          });
        }

        if (existingWalletUser) {
          // Wallet belongs to an existing account - switch to that account
          // This allows a member to sign in with their Diamond wallet and take over the session
          const { token, expiresAt } = await createSession(existingWalletUser.id);

          // Return info about the switched account
          const switchedToDiamond = existingWalletUser.subscription?.tier === "DIAMOND" &&
            existingWalletUser.subscription?.status === "ACTIVE";

          const res = NextResponse.json({
            ok: true,
            switched: true,
            switchedToDiamond,
          }, { headers: noCache });
          setSessionCookieOnResponse(res, token, expiresAt);
          return res;
        }

        // Wallet doesn't exist in system - don't silently create a new wallet-native account
        // Let UI offer "Link wallet" or "Switch account"
        return NextResponse.json(
          { ok: false, error: "WALLET_NOT_LINKED", wallet: w },
          { status: 409, headers: noCache }
        );
      }
    }

    // Create or fetch wallet user (email fields stay null)
    // Retry loop for referralCode unique constraint collisions
    let user: { id: string; email: string | null; solWallet: string | null; referralCode: string | null } | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        user = await db.user.upsert({
          where: { walletAddress: w },
          update: {},
          create: { walletAddress: w, referralCode: generateReferralCode() },
          select: { id: true, email: true, solWallet: true, referralCode: true },
        });
        break;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // Retry only if unique constraint on referralCode
        if (!msg.includes("Unique constraint") || !msg.includes("referralCode")) {
          throw e;
        }
        // Continue to next attempt
      }
    }

    if (!user) {
      return NextResponse.json({ ok: false, error: "Failed to create user" }, { status: 500, headers: noCache });
    }

    // Auto-backfill solWallet for wallet-native users (no email, solWallet is null)
    // This makes them payout-eligible immediately
    if (!user.email && !user.solWallet) {
      await db.user.update({
        where: { id: user.id },
        data: { solWallet: w, solWalletLinkedAt: new Date() },
      }).catch(() => {});
    }

    // Backfill referral code for existing users who don't have one
    if (!user.referralCode) {
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          await db.user.update({
            where: { id: user.id },
            data: { referralCode: generateReferralCode() },
          });
          break;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes("Unique constraint") || !msg.includes("referralCode")) {
            break; // Non-collision error, just skip
          }
        }
      }
    }

    // NOTE: Do NOT create a placeholder subscription here.
    // Subscription is created ONLY when payment is confirmed or trial is started.
    // Creating PENDING with null expiry was granting free access.

    // Create session using shared helper (TTL from env)
    const { token, expiresAt } = await createSession(user.id);

    const res = NextResponse.json({ ok: true }, { headers: noCache });
    setSessionCookieOnResponse(res, token, expiresAt);
    return res;
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json({ ok: false, error: "Verify failed" }, { status: 500, headers: noCache });
  }
}
