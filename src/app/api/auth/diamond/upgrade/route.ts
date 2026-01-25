/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 *
 * POST /api/auth/diamond/upgrade
 *
 * Upgrade an email-based Member account to Diamond:
 * - Requires an authenticated session (email/member)
 * - Verifies wallet signature via WalletLinkChallenge (purpose: DIAMOND_UPGRADE)
 * - Sets walletAddress (auth identity) on the SAME user row (no new account)
 * - Upserts subscription to DIAMOND + PENDING
 *
 * This preserves the user's existing data (comments, likes, rewards).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import bs58 from "bs58";
import nacl from "tweetnacl";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  const access = await getAccessContext();
  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: noCache });
  }

  // Must be an eligible Member to upgrade
  const sub = access.user.subscription;
  const isMemberEligible =
    !!sub &&
    sub.tier === "MEMBER" &&
    (sub.status === "ACTIVE" || sub.status === "TRIAL" || sub.status === "PARTIAL");

  if (!isMemberEligible) {
    return NextResponse.json({ ok: false, error: "MEMBERSHIP_REQUIRED" }, { status: 403, headers: noCache });
  }

  const { wallet, signature, nonce } = await req.json();
  const w = String(wallet ?? "").trim();
  const s = String(signature ?? "").trim();
  const n = String(nonce ?? "").trim();

  if (!w || !s || !n) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400, headers: noCache });
  }

  const ch = await db.walletLinkChallenge.findUnique({ where: { nonce: n } });
  if (!ch || ch.userId !== access.user.id) {
    return NextResponse.json({ ok: false, error: "Invalid challenge" }, { status: 400, headers: noCache });
  }
  if (ch.purpose !== "DIAMOND_UPGRADE") {
    return NextResponse.json({ ok: false, error: "Wrong challenge purpose" }, { status: 400, headers: noCache });
  }
  if (ch.usedAt) {
    return NextResponse.json({ ok: false, error: "Challenge already used" }, { status: 400, headers: noCache });
  }
  if (new Date() > ch.expiresAt) {
    return NextResponse.json({ ok: false, error: "Challenge expired" }, { status: 400, headers: noCache });
  }

  // Verify signature against the stored challenge message
  let pubkeyBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    pubkeyBytes = bs58.decode(w);
    sigBytes = bs58.decode(s);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid base58 encoding" }, { status: 400, headers: noCache });
  }

  const msgBytes = new TextEncoder().encode(ch.message);
  const ok = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Bad signature" }, { status: 400, headers: noCache });
  }

  // Prevent one wallet from being linked to multiple accounts (auth OR payout)
  const existing = await db.user.findFirst({
    where: {
      OR: [{ walletAddress: w }, { solWallet: w }],
      NOT: { id: access.user.id },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: false, error: "WALLET_ALREADY_LINKED" }, { status: 409, headers: noCache });
  }

  // Atomically: set auth wallet + ensure payout wallet + mark subscription pending + consume challenge
  await db.$transaction([
    db.user.update({
      where: { id: access.user.id },
      data: {
        walletAddress: w, // <-- the upgrade moment
        solWallet: access.user.solWallet ?? w,
        solWalletLinkedAt: access.user.solWallet ? undefined : new Date(),
      },
    }),
    db.subscription.upsert({
      where: { userId: access.user.id },
      update: { tier: "DIAMOND", status: "PENDING" },
      create: { userId: access.user.id, tier: "DIAMOND", status: "PENDING" },
    }),
    db.walletLinkChallenge.update({
      where: { nonce: n },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true }, { headers: noCache });
}
