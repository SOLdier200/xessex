import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bs58 from "bs58";
import nacl from "tweetnacl";

const prisma = new PrismaClient();

function cookieOpts() {
  const prod = process.env.NODE_ENV === "production";
  return { httpOnly: true, secure: prod, sameSite: "lax" as const, path: "/" };
}

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

    const user = await prisma.user.upsert({
      where: { walletAddress: w },
      update: {},
      create: { walletAddress: w },
    });

    const token = crypto.randomUUID() + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

    await prisma.session.create({ data: { userId: user.id, token, expiresAt } });

    const res = NextResponse.json({ ok: true });
    res.cookies.set("xessex_session", token, { ...cookieOpts(), expires: expiresAt });
    return res;
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json({ ok: false, error: "Verify failed" }, { status: 500 });
  }
}
