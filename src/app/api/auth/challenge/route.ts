import { NextResponse } from "next/server";

export async function POST() {
  const nonce = crypto.randomUUID();
  const issuedAt = new Date().toISOString();

  const message =
    `Xessex Wallet Login\n` +
    `Nonce: ${nonce}\n` +
    `IssuedAt: ${issuedAt}\n` +
    `Purpose: Sign to prove you own this wallet. No blockchain transaction.`;

  return NextResponse.json({ ok: true, nonce, issuedAt, message });
}
