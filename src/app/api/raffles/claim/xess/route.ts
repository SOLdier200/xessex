/**
 * Claim XESS Raffle Prize
 *
 * POST /api/raffles/claim/xess
 *
 * Body: { winnerId: string }
 *
 * Claims a pending XESS raffle win by transferring tokens from treasury to user.
 * Requires XESS_TREASURY_KEYPAIR environment variable for server-side signing.
 * Expires removes claim (cannot claim after expiry).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { payoutXessToWallet } from "@/lib/xessTreasuryPayout";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = await getAccessContext();
  if (!ctx.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const winnerId = String(body?.winnerId || "");
  if (!winnerId) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const now = new Date();

  const user = await db.user.findUnique({
    where: { id: ctx.user.id },
    select: { id: true, solWallet: true },
  });
  if (!user?.solWallet) {
    return NextResponse.json({ ok: false, error: "no_linked_wallet" }, { status: 400 });
  }

  const w = await db.raffleWinner.findUnique({
    where: { id: winnerId },
    include: { raffle: true },
  });

  if (!w || w.userId !== ctx.user.id) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (w.raffle.type !== "XESS") {
    return NextResponse.json({ ok: false, error: "wrong_type" }, { status: 400 });
  }

  if (w.status !== "PENDING") {
    return NextResponse.json({ ok: false, error: "not_pending" }, { status: 400 });
  }

  if (now > w.expiresAt) {
    return NextResponse.json({ ok: false, error: "expired" }, { status: 400 });
  }

  if (w.prizeXessAtomic <= 0n) {
    return NextResponse.json({ ok: false, error: "no_prize" }, { status: 400 });
  }

  // Payout from treasury to user wallet
  let txSig: string;
  try {
    txSig = await payoutXessToWallet({
      toWallet: user.solWallet,
      amountAtomic: w.prizeXessAtomic,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[RAFFLE_CLAIM_XESS] Payout failed:", msg);
    return NextResponse.json({ ok: false, error: "payout_failed", message: msg }, { status: 500 });
  }

  await db.raffleWinner.update({
    where: { id: w.id },
    data: {
      status: "CLAIMED",
      claimedAt: now,
      txSig,
    },
  });

  return NextResponse.json({ ok: true, txSig });
}
