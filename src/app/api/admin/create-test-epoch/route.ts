/**
 * Admin endpoint to create a fresh test epoch using REAL user rewards.
 *
 * This:
 * 1. Finds ALL PAID, unclaimed RewardEvents from ALL real weekKeys
 * 2. Aggregates totals per user (across all weeks)
 * 3. Creates a new ClaimEpoch with fresh epoch number (V2 format)
 * 4. Creates ClaimLeaf records with merkle proofs and V2 fields
 *
 * NO COPIES are created - just a new epoch referencing real rewards.
 * Ready for on-chain publishing and claim testing with real amounts.
 */

import { NextResponse } from "next/server";
import { requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";
import { getNextEpochNumber } from "@/lib/epochRoot";
import { ALL_REWARD_TYPES } from "@/lib/claimables";
import {
  buildMerkle,
  getProof,
  leafHashV2,
  toHex32,
  userKey32FromWallet,
  generateSalt32,
} from "@/lib/merkleSha256";

export const runtime = "nodejs";

export async function POST() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    // Find ALL PAID, unclaimed rewards from ALL real weekKeys (not test weekKeys)
    const paidRewards = await db.rewardEvent.findMany({
      where: {
        status: "PAID",
        claimedAt: null,
        weekKey: { not: { startsWith: "test" } }, // Only real weekKeys
        type: { in: ALL_REWARD_TYPES },
      },
      include: {
        user: { select: { id: true, walletAddress: true } },
      },
    });

    if (paidRewards.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "NO_PENDING_REWARDS",
        message: "No pending rewards found. Run Weekly Distribute first to calculate and distribute rewards to users.",
      }, { status: 400 });
    }

    // Get unique weekKeys for reference
    const weekKeys = [...new Set(paidRewards.map(r => r.weekKey))];

    // Always use a test weekKey for testing (no copies, just a reference)
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 6);
    const testWeekKey = `test-${dateStr}-${rand}`;

    // Get next epoch number
    const lastEpoch = await db.claimEpoch.findFirst({ orderBy: { epoch: "desc" } });
    const epochNumber = await getNextEpochNumber(lastEpoch?.epoch ?? null);

    // NO copying - we just build the epoch from existing rewards

    // Aggregate rewards by user
    const userTotals = new Map<string, { oderId: string; wallet: string; amount: bigint }>();

    for (const reward of paidRewards) {
      const wallet = reward.user.walletAddress;
      if (!wallet) continue; // Skip users without wallets

      const existing = userTotals.get(reward.userId);
      if (existing) {
        existing.amount += reward.amount;
      } else {
        userTotals.set(reward.userId, {
          oderId: reward.userId,
          wallet: wallet, // Keep original case - base58 is case-sensitive
          amount: reward.amount,
        });
      }
    }

    if (userTotals.size === 0) {
      return NextResponse.json({
        ok: false,
        error: "NO_USERS_WITH_WALLETS",
        message: "No users with wallets found in PAID rewards",
      }, { status: 400 });
    }

    // Debug: Log user totals
    console.log("[create-test-epoch] User totals (6-decimal amounts):");
    for (const [userId, data] of userTotals) {
      const xessAmount = Number(data.amount) / 1_000_000;
      console.log(`  ${userId.slice(0, 8)}... wallet=${data.wallet.slice(0, 8)}... amount=${data.amount} (${xessAmount} XESS)`);
    }

    // Convert to 9 decimals for on-chain (rewards are stored with 6 decimals)
    const DECIMAL_CONVERSION = 1000n; // 10^9 / 10^6

    // Build V2 leaf data with userKey and salt
    const leafData: {
      oderId: string;
      wallet: string;
      amount: bigint;
      amount9: bigint;
      userKey32: Buffer;
      salt32: Buffer;
    }[] = [];

    for (const [, data] of userTotals) {
      const amount9 = data.amount * DECIMAL_CONVERSION;
      const userKey32 = userKey32FromWallet(data.wallet);
      const salt32 = generateSalt32();

      leafData.push({
        oderId: data.oderId,
        wallet: data.wallet,
        amount: data.amount,
        amount9,
        userKey32,
        salt32,
      });
    }

    // Sort by userKeyHex for deterministic merkle tree
    leafData.sort((a, b) => {
      const aHex = toHex32(a.userKey32);
      const bHex = toHex32(b.userKey32);
      return aHex.localeCompare(bHex);
    });

    // Build V2 leaf hashes
    const leafBuffers = leafData.map((ld, index) =>
      leafHashV2({
        userKey32: ld.userKey32,
        epoch: BigInt(epochNumber),
        amountAtomic: ld.amount9,
        index,
        salt32: ld.salt32,
      })
    );

    // Build merkle tree
    const { root, layers } = buildMerkle(leafBuffers);
    const rootHex = toHex32(root);

    // Create ClaimEpoch
    const totalAtomic9 = leafData.reduce((sum, l) => sum + l.amount9, 0n);
    await db.claimEpoch.create({
      data: {
        epoch: epochNumber,
        weekKey: testWeekKey,
        version: 2,
        rootHex,
        totalAtomic: totalAtomic9,
        leafCount: leafData.length,
        setOnChain: false,
      },
    });

    // Create ClaimLeaf for each user with V2 fields
    for (let i = 0; i < leafData.length; i++) {
      const ld = leafData[i];
      const proofHex = getProof(layers, i).map(toHex32);

      await db.claimLeaf.create({
        data: {
          epoch: epochNumber,
          weekKey: testWeekKey,
          index: i,
          userId: ld.oderId,
          wallet: ld.wallet,
          amountAtomic: ld.amount9,
          proofHex,
          userKeyHex: toHex32(ld.userKey32),
          claimSaltHex: toHex32(ld.salt32),
        },
      });

      // Also store in ClaimSalt table for consistency
      await db.claimSalt.upsert({
        where: { epoch_userId: { epoch: epochNumber, userId: ld.oderId } },
        create: {
          epoch: epochNumber,
          userId: ld.oderId,
          userKeyHex: toHex32(ld.userKey32),
          claimSaltHex: toHex32(ld.salt32),
        },
        update: {
          userKeyHex: toHex32(ld.userKey32),
          claimSaltHex: toHex32(ld.salt32),
        },
      });
    }

    // Format amounts for display (6 decimals)
    const formatXess = (amount: bigint) => {
      const whole = amount / 1_000_000n;
      const frac = amount % 1_000_000n;
      if (frac === 0n) return whole.toLocaleString();
      return `${whole.toLocaleString()}.${frac.toString().padStart(6, "0").replace(/0+$/, "")}`;
    };

    const totalAmount6 = leafData.reduce((sum, l) => sum + l.amount, 0n);

    return NextResponse.json({
      ok: true,
      sourceWeekKeys: weekKeys,
      testWeekKey,
      epoch: epochNumber,
      rootHex,
      leafCount: leafData.length,
      rewardCount: paidRewards.length,
      totalAtomic: totalAtomic9.toString(),
      totalXess: formatXess(totalAmount6),
      users: leafData.map(l => ({
        oderId: l.oderId.slice(0, 8) + "...",
        wallet: l.wallet.slice(0, 8) + "...",
        amount: formatXess(l.amount),
      })),
      nextStep: `Run: node solana-programs/xess-claim/set-epoch-root.mjs ${epochNumber} ${rootHex}`,
    });
  } catch (e) {
    console.error("Create test epoch error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
