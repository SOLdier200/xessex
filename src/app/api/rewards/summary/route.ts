import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userId = user.id;

  // "Current" epoch = latest one with a merkleRoot set (claimable)
  const epoch = await db.rewardEpoch.findFirst({
    where: { merkleRoot: { not: null } },
    orderBy: { epochNo: "desc" },
  });

  if (!epoch) {
    return NextResponse.json({
      ok: true,
      epoch: null,
      pendingAmount: "0",
      hasPending: false,
      claim: null,
    });
  }

  const leaf = await db.rewardEpochLeaf.findUnique({
    where: { epochId_userId: { epochId: epoch.id, userId } },
  });

  const claim = await db.rewardClaim.findUnique({
    where: { userId_epochId: { userId, epochId: epoch.id } },
  });

  const pendingAmount = leaf?.amount ?? BigInt(0);

  // If already CLAIMED, no pending
  const hasPending = pendingAmount > 0n && claim?.status !== "CLAIMED";

  return NextResponse.json({
    ok: true,
    epoch: { id: epoch.id, epochNo: epoch.epochNo, merkleRoot: epoch.merkleRoot },
    pendingAmount: pendingAmount.toString(),
    hasPending,
    claim: claim
      ? {
          id: claim.id,
          status: claim.status,
          amount: claim.amount.toString(),
          txSig: claim.txSig ?? null,
          startedAt: claim.startedAt,
          claimedAt: claim.claimedAt,
          error: claim.error ?? null,
        }
      : null,
  });
}
