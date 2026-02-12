/**
 * POST /api/admin/repair-false-claims
 *
 * Repairs rewards that were falsely marked as claimed by the pending route bug.
 * The bug marked ALL unclaimed rewards as claimed (without a txSig) when it
 * found any on-chain receipt for any epoch.
 *
 * This endpoint:
 * 1. Finds rewards with claimedAt set but no txSig (or txSig = "synced-from-onchain")
 * 2. For each, checks if the on-chain receipt actually exists for that epoch
 * 3. If no on-chain receipt exists, resets claimedAt and txSig to null
 *
 * Query params:
 * - userId: Specific user to repair (optional, repairs all if omitted)
 * - dryRun: If "true", just shows what would be repaired (default: true)
 */

import { NextResponse, NextRequest } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";
import { ALL_REWARD_TYPES } from "@/lib/claimables";
import { fromHex32 } from "@/lib/merkleSha256";

export const runtime = "nodejs";

function getProgramId() {
  return new PublicKey(process.env.NEXT_PUBLIC_XESS_CLAIM_PROGRAM_ID!);
}

function u64LE(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminOrMod();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const targetUserId: string | undefined = body.userId;
  const dryRun = body.dryRun !== false; // default true

  // Find rewards that look like they were falsely marked
  // The bug set claimedAt but no txSig (null), or txSig = "synced-from-onchain"
  const falselyClaimedWhere = {
    claimedAt: { not: null as any },
    status: "PAID" as const,
    type: { in: ALL_REWARD_TYPES },
    OR: [
      { txSig: null },
      { txSig: "synced-from-onchain" },
    ],
    ...(targetUserId ? { userId: targetUserId } : {}),
  };

  const falselyClaimed = await db.rewardEvent.findMany({
    where: falselyClaimedWhere,
    select: {
      id: true,
      userId: true,
      weekKey: true,
      type: true,
      amount: true,
      claimedAt: true,
      txSig: true,
    },
  });

  if (falselyClaimed.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No falsely claimed rewards found",
      count: 0,
    });
  }

  // Group by userId + weekKey to check on-chain receipts efficiently
  const groupedByUserWeek = new Map<string, typeof falselyClaimed>();
  for (const r of falselyClaimed) {
    const key = `${r.userId}:${r.weekKey}`;
    const arr = groupedByUserWeek.get(key) || [];
    arr.push(r);
    groupedByUserWeek.set(key, arr);
  }

  // For each group, check if there's actually an on-chain receipt
  const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");

  const toRepair: string[] = []; // reward IDs to reset
  const alreadyClaimed: string[] = []; // reward IDs that are actually claimed on-chain
  const details: Array<{ userId: string; weekKey: string; count: number; action: string; amount: string }> = [];

  for (const [key, rewards] of groupedByUserWeek) {
    const [userId, weekKey] = key.split(":");

    // Find the ClaimLeaf for this user + weekKey
    const leaf = await db.claimLeaf.findFirst({
      where: { userId, weekKey },
      include: {
        epochRel: { select: { epoch: true, setOnChain: true, version: true } },
      },
    });

    let hasOnChainReceipt = false;

    if (leaf?.userKeyHex && leaf.epochRel.setOnChain) {
      try {
        const epochBigInt = BigInt(leaf.epochRel.epoch);
        const [receiptV2Pda] = PublicKey.findProgramAddressSync(
          [Buffer.from("receipt_v2"), u64LE(epochBigInt), fromHex32(leaf.userKeyHex)],
          getProgramId()
        );
        const receiptInfo = await connection.getAccountInfo(receiptV2Pda);
        hasOnChainReceipt = !!(receiptInfo && receiptInfo.owner.equals(getProgramId()));
      } catch (err) {
        console.error(`[repair] Error checking receipt for ${key}:`, err);
      }
    }

    const totalAmount = rewards.reduce((sum, r) => sum + r.amount, 0n);
    const formatted = `${(Number(totalAmount) / 1_000_000).toLocaleString()} XESS`;

    if (hasOnChainReceipt) {
      // This was actually claimed — don't repair
      alreadyClaimed.push(...rewards.map(r => r.id));
      details.push({ userId, weekKey, count: rewards.length, action: "KEEP (on-chain receipt exists)", amount: formatted });
    } else {
      // No on-chain receipt — this was falsely marked, repair it
      toRepair.push(...rewards.map(r => r.id));
      details.push({ userId, weekKey, count: rewards.length, action: dryRun ? "WOULD REPAIR" : "REPAIRED", amount: formatted });
    }
  }

  if (!dryRun && toRepair.length > 0) {
    // Reset the falsely claimed rewards
    const updated = await db.rewardEvent.updateMany({
      where: { id: { in: toRepair } },
      data: { claimedAt: null, txSig: null },
    });
    console.log(`[repair] Repaired ${updated.count} falsely claimed rewards`);
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    totalFalselyClaimed: falselyClaimed.length,
    toRepair: toRepair.length,
    alreadyClaimed: alreadyClaimed.length,
    details,
    message: dryRun
      ? `Found ${toRepair.length} rewards to repair. Run with dryRun: false to apply.`
      : `Repaired ${toRepair.length} rewards.`,
  });
}
