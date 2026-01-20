/**
 * Admin endpoint to mark a ClaimEpoch as set on-chain.
 * Called after manually running set-epoch-root.mjs CLI.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const epoch = body.epoch;
  const txSig = body.txSig;

  if (typeof epoch !== "number" || epoch < 1) {
    return NextResponse.json({ ok: false, error: "Invalid epoch" }, { status: 400 });
  }

  // Find the epoch
  const existing = await db.claimEpoch.findUnique({ where: { epoch } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Epoch not found" }, { status: 404 });
  }

  if (existing.setOnChain) {
    return NextResponse.json({
      ok: true,
      alreadySet: true,
      epoch,
      txSig: existing.onChainTxSig,
    });
  }

  // Update the epoch
  await db.claimEpoch.update({
    where: { epoch },
    data: {
      setOnChain: true,
      onChainTxSig: txSig || null,
      setOnChainAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    epoch,
    txSig: txSig || null,
  });
}
