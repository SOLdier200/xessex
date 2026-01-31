import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userId = user.id;

  // Check wallet is linked
  const userRecord = await db.user.findUnique({
    where: { id: userId },
    select: { walletAddress: true },
  });

  if (!userRecord?.walletAddress) {
    return NextResponse.json(
      { ok: false, error: "WALLET_NOT_LINKED" },
      { status: 400 }
    );
  }

  // Find current claimable epoch
  const epoch = await db.rewardEpoch.findFirst({
    where: { merkleRoot: { not: null } },
    orderBy: { epochNo: "desc" },
  });

  if (!epoch?.merkleRoot) {
    return NextResponse.json({ ok: false, error: "NO_CLAIMABLE_EPOCH" }, { status: 400 });
  }

  // Find user's leaf for this epoch
  const leaf = await db.rewardEpochLeaf.findUnique({
    where: { epochId_userId: { epochId: epoch.id, userId } },
  });

  const amount = leaf?.amount ?? 0n;

  if (!leaf || amount <= 0n) {
    return NextResponse.json({ ok: false, error: "NOTHING_TO_CLAIM" }, { status: 400 });
  }

  // Idempotent: one claim per user+epoch, enforced by @@unique([userId, epochId])
  // First check if claim exists
  const existingClaim = await db.rewardClaim.findUnique({
    where: { userId_epochId: { userId, epochId: epoch.id } },
  });

  let claim;

  if (existingClaim) {
    // If already claimed, return it (UI will show tx link)
    if (existingClaim.status === "CLAIMED") {
      return NextResponse.json({
        ok: true,
        alreadyClaimed: true,
        claimId: existingClaim.id,
        txSig: existingClaim.txSig,
      });
    }

    // If FAILED, reset to PROCESSING for retry
    if (existingClaim.status === "FAILED") {
      claim = await db.rewardClaim.update({
        where: { id: existingClaim.id },
        data: {
          status: "PROCESSING",
          amount, // keep in sync with leaf
          leafIndex: leaf.leafIndex,
          error: null,
        },
      });
    } else {
      // PROCESSING - just return it
      claim = existingClaim;
    }
  } else {
    // Create new claim
    claim = await db.rewardClaim.create({
      data: {
        userId,
        epochId: epoch.id,
        amount,
        status: "PROCESSING",
        leafIndex: leaf.leafIndex,
      },
    });
  }

  // Return everything the wallet needs to submit on-chain
  const proof = JSON.parse(leaf.proofJson) as string[];

  return NextResponse.json({
    ok: true,
    alreadyClaimed: false,
    claimId: claim.id,
    epoch: { id: epoch.id, epochNo: epoch.epochNo, merkleRoot: epoch.merkleRoot },
    leaf: {
      amount: amount.toString(),
      leafIndex: leaf.leafIndex,
      proof,
    },
    payoutWallet: userRecord.walletAddress,
  });
}
