import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

/**
 * POST /api/rewards/claim/confirm
 * Confirm a claim after on-chain transaction
 *
 * Body: { txSig: string, rewardIds: string[] }
 *
 * - Verifies tx signature on-chain (TODO: implement actual verification)
 * - If success: marks PAID with txSig
 * - If failed: reverts to PENDING
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    txSig?: string;
    rewardIds?: string[];
  } | null;

  const txSig = body?.txSig?.trim();
  const rewardIds = body?.rewardIds;

  if (!txSig || !rewardIds || !Array.isArray(rewardIds) || rewardIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "MISSING_FIELDS", required: ["txSig", "rewardIds"] },
      { status: 400 }
    );
  }

  try {
    // Verify the rewards belong to this user and are in PROCESSING status
    const rewards = await db.rewardEvent.findMany({
      where: {
        id: { in: rewardIds },
        userId: access.user.id,
        status: "PROCESSING",
      },
    });

    if (rewards.length !== rewardIds.length) {
      return NextResponse.json(
        { ok: false, error: "INVALID_REWARDS", found: rewards.length, expected: rewardIds.length },
        { status: 400 }
      );
    }

    // TODO: Verify transaction signature on-chain
    // For now, we trust the client to provide a valid signature
    // In production, use @solana/web3.js to verify the transaction:
    // 1. Connect to RPC
    // 2. Get transaction by signature
    // 3. Verify it's confirmed and matches expected program/data
    const txVerified = true; // Placeholder

    if (!txVerified) {
      // Revert to PENDING on verification failure
      await db.rewardEvent.updateMany({
        where: { id: { in: rewardIds } },
        data: { status: "PENDING" },
      });

      return NextResponse.json(
        { ok: false, error: "TX_VERIFICATION_FAILED" },
        { status: 400 }
      );
    }

    // Mark as PAID
    const now = new Date();
    await db.rewardEvent.updateMany({
      where: { id: { in: rewardIds } },
      data: {
        status: "PAID",
        txSig,
        paidAt: now,
        claimedAt: now,
      },
    });

    // Calculate total claimed
    const totalClaimed = rewards.reduce((sum, r) => sum + r.amount, 0n);

    return NextResponse.json({
      ok: true,
      txSig,
      claimedCount: rewards.length,
      totalClaimed: totalClaimed.toString(),
      claimedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("[CLAIM_CONFIRM] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

/**
 * DELETE /api/rewards/claim/confirm
 * Cancel a pending claim (revert PROCESSING to PENDING)
 *
 * Body: { rewardIds: string[] }
 */
export async function DELETE(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    rewardIds?: string[];
  } | null;

  const rewardIds = body?.rewardIds;

  if (!rewardIds || !Array.isArray(rewardIds) || rewardIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "MISSING_FIELDS", required: ["rewardIds"] },
      { status: 400 }
    );
  }

  try {
    // Only revert rewards that belong to this user and are PROCESSING
    const result = await db.rewardEvent.updateMany({
      where: {
        id: { in: rewardIds },
        userId: access.user.id,
        status: "PROCESSING",
      },
      data: { status: "PENDING" },
    });

    return NextResponse.json({
      ok: true,
      revertedCount: result.count,
    });
  } catch (error) {
    console.error("[CLAIM_CANCEL] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
