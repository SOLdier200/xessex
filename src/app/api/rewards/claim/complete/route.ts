import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const Body = z.object({
  claimId: z.string().min(10),
  txSig: z.string().min(20),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userId = user.id;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { claimId, txSig } = parsed.data;

  // Find the claim
  const claim = await db.rewardClaim.findUnique({ where: { id: claimId } });
  if (!claim || claim.userId !== userId) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  // Idempotent: if already CLAIMED with same txSig, return ok
  if (claim.status === "CLAIMED") {
    return NextResponse.json({ ok: true, status: "CLAIMED", txSig: claim.txSig });
  }

  // Check if txSig is already used (it's @unique)
  const existingTx = await db.rewardClaim.findUnique({ where: { txSig } });
  if (existingTx && existingTx.id !== claimId) {
    return NextResponse.json({ ok: false, error: "TX_ALREADY_USED" }, { status: 400 });
  }

  // TODO: Optional - verify transaction on-chain using @solana/web3.js
  // 1. Connect to RPC
  // 2. Get transaction by signature
  // 3. Verify it's confirmed and matches expected program/data
  // For now, we trust the client + on-chain program already verified

  // Mark as CLAIMED
  const updated = await db.rewardClaim.update({
    where: { id: claimId },
    data: {
      status: "CLAIMED",
      txSig,
      claimedAt: new Date(),
      error: null,
    },
  });

  return NextResponse.json({ ok: true, status: updated.status, txSig: updated.txSig });
}
