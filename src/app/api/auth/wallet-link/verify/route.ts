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

  const pubkeyBytes = bs58.decode(w);
  const sigBytes = bs58.decode(s);
  const msgBytes = new TextEncoder().encode(ch.message);

  const ok = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Bad signature" }, { status: 400 });
  }

  // Prevent one wallet from being linked to multiple accounts
  const existing = await db.user.findFirst({ where: { solWallet: w } });
  if (existing && existing.id !== access.user.id) {
    return NextResponse.json({ ok: false, error: "Wallet already linked to another account" }, { status: 409 });
  }

  await db.$transaction([
    db.user.update({
      where: { id: access.user.id },
      data: { solWallet: w, solWalletLinkedAt: new Date() },
    }),
    db.walletLinkChallenge.update({
      where: { nonce: n },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true, wallet: w });
}
