import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import bs58 from "bs58";
import nacl from "tweetnacl";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const access = await getAccessContext();
  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { wallet, signature, nonce } = await req.json();
  const w = String(wallet ?? "").trim();
  const s = String(signature ?? "").trim();
  const n = String(nonce ?? "").trim();

  if (!w || !s || !n) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const ch = await db.walletLinkChallenge.findUnique({ where: { nonce: n } });
  if (!ch || ch.userId !== access.user.id) {
    return NextResponse.json({ ok: false, error: "Invalid challenge" }, { status: 400 });
  }
  if (ch.usedAt) {
    return NextResponse.json({ ok: false, error: "Challenge already used" }, { status: 400 });
  }
  if (new Date() > ch.expiresAt) {
    return NextResponse.json({ ok: false, error: "Challenge expired" }, { status: 400 });
  }

  // Verify signature against the stored challenge message
  let pubkeyBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    pubkeyBytes = bs58.decode(w);
    sigBytes = bs58.decode(s);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid base58 encoding" }, { status: 400 });
  }

  const msgBytes = new TextEncoder().encode(ch.message);
  const ok = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Bad signature" }, { status: 400 });
  }

  // Prevent one wallet from being linked to multiple accounts
  // Check both walletAddress (auth wallet) and solWallet (payout wallet)
  const existing = await db.user.findFirst({
    where: {
      OR: [{ walletAddress: w }, { solWallet: w }],
      NOT: { id: access.user.id },
    },
  });
  if (existing) {
    return NextResponse.json({ ok: false, error: "Wallet already linked to another account" }, { status: 409 });
  }

  // Update auth wallet; optionally backfill solWallet for convenience if it's empty
  const userUpdateData: { walletAddress: string; solWallet?: string; solWalletLinkedAt?: Date } = {
    walletAddress: w,
  };
  if (!access.user.solWallet) {
    userUpdateData.solWallet = w;
    userUpdateData.solWalletLinkedAt = new Date();
  }

  await db.$transaction([
    db.user.update({
      where: { id: access.user.id },
      data: userUpdateData,
    }),
    db.walletLinkChallenge.update({
      where: { nonce: n },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true, wallet: w });
}
