import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import crypto from "crypto";

export const runtime = "nodejs";

function makeNonce() {
  return crypto.randomBytes(16).toString("hex");
}

export async function POST() {
  const access = await getAccessContext();
  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const nonce = makeNonce();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 min

  // Include userId + nonce + expiry to prevent replay & cross-account linking
  const message =
    `Xessex Wallet Link\n` +
    `User: ${access.user.id}\n` +
    `Nonce: ${nonce}\n` +
    `Expires: ${expiresAt.toISOString()}\n` +
    `Purpose: Link this SOL wallet to receive Xess payments & interactions.`;

  await db.walletLinkChallenge.create({
    data: {
      userId: access.user.id,
      nonce,
      message,
      expiresAt,
      purpose: "AUTH_LINK",
    },
  });

  return NextResponse.json({ ok: true, message, nonce, expiresAt });
}
