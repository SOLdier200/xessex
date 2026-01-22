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

  const message =
    `Xessex Auth Wallet Link\n` +
    `User: ${access.user.id}\n` +
    `Nonce: ${nonce}\n` +
    `Expires: ${expiresAt.toISOString()}\n` +
    `Purpose: Link this wallet for login & Diamond access. No blockchain transaction.`;

  await db.walletLinkChallenge.create({
    data: {
      userId: access.user.id,
      nonce,
      message,
      expiresAt,
    },
  });

  return NextResponse.json(
    { ok: true, message, nonce, expiresAt },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, private" } }
  );
}
