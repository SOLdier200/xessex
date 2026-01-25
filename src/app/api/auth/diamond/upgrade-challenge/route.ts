/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 *
 * POST /api/auth/diamond/upgrade-challenge
 *
 * Creates a wallet link challenge specifically for Member → Diamond upgrade.
 * Requires an active Member subscription.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import crypto from "crypto";

export const runtime = "nodejs";

function makeNonce() {
  return crypto.randomBytes(16).toString("hex");
}

export async function POST() {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  const access = await getAccessContext();
  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: noCache });
  }

  // Must be an eligible Member to initiate an upgrade challenge
  const sub = access.user.subscription;
  const isMemberEligible =
    !!sub &&
    sub.tier === "MEMBER" &&
    (sub.status === "ACTIVE" || sub.status === "TRIAL" || sub.status === "PARTIAL");

  if (!isMemberEligible) {
    return NextResponse.json({ ok: false, error: "MEMBERSHIP_REQUIRED" }, { status: 403, headers: noCache });
  }

  const nonce = makeNonce();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 min

  const message =
    `Xessex Diamond Upgrade\n` +
    `User: ${access.user.id}\n` +
    `Nonce: ${nonce}\n` +
    `Expires: ${expiresAt.toISOString()}\n` +
    `Purpose: Upgrade this Member account to Diamond. No blockchain transaction.`;

  await db.walletLinkChallenge.create({
    data: {
      userId: access.user.id,
      nonce,
      message,
      expiresAt,
      purpose: "DIAMOND_UPGRADE",
    },
  });

  return NextResponse.json(
    { ok: true, message, nonce, expiresAt },
    { headers: noCache }
  );
}
