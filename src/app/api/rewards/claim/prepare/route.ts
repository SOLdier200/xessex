import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

/**
 * POST /api/rewards/claim/prepare
 * Prepare pending rewards for claiming
 *
 * - Verifies user auth + wallet linked
 * - Gets pending RewardEvents for user
 * - Marks them as PROCESSING
 * - Returns merkle proof + claim data
 */
export async function POST() {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Get user with wallet
  const user = await db.user.findUnique({
    where: { id: access.user.id },
    select: { id: true, solWallet: true },
  });

  if (!user?.solWallet) {
    return NextResponse.json(
      { ok: false, error: "WALLET_NOT_LINKED" },
      { status: 400 }
    );
  }

  try {
    // Get pending rewards for this user
    const pendingRewards = await db.rewardEvent.findMany({
      where: {
        userId: user.id,
        status: "PENDING",
      },
      orderBy: { createdAt: "asc" },
    });

    if (pendingRewards.length === 0) {
      return NextResponse.json({
        ok: true,
        hasPending: false,
        totalAmount: "0",
        rewards: [],
      });
    }

    // Calculate total amount
    const totalAmount = pendingRewards.reduce((sum, r) => sum + r.amount, 0n);

    // Mark as PROCESSING in a transaction
    const result = await db.$transaction(async (tx) => {
      const updatedRewards = [];

      for (const reward of pendingRewards) {
        const updated = await tx.rewardEvent.update({
          where: { id: reward.id },
          data: { status: "PROCESSING" },
        });
        updatedRewards.push(updated);
      }

      return updatedRewards;
    });

    // Build claim data
    const claimData = result.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount.toString(),
      weekKey: r.weekKey,
      merkleIndex: r.merkleIndex,
      merkleProof: r.merkleProof ? JSON.parse(r.merkleProof) : [],
    }));

    // Get the merkle root from the batch (use the latest week's batch)
    const weekKeys = [...new Set(result.map(r => r.weekKey))];
    const batches = await db.rewardBatch.findMany({
      where: { weekKey: { in: weekKeys } },
      select: { weekKey: true, merkleRoot: true },
    });

    const batchMap = Object.fromEntries(batches.map(b => [b.weekKey, b.merkleRoot]));

    return NextResponse.json({
      ok: true,
      hasPending: true,
      totalAmount: totalAmount.toString(),
      walletAddress: user.solWallet,
      rewards: claimData,
      batches: batchMap,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minute window
    });
  } catch (error) {
    console.error("[CLAIM_PREPARE] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
