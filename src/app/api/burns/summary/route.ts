/**
 * GET /api/burns/summary
 * Public endpoint returning burn statistics
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

// XESS token total supply (1 billion with 9 decimals)
const TOTAL_SUPPLY_ATOMIC = 1_000_000_000n * 1_000_000_000n; // 1B tokens * 10^9

// BurnRecord stores with 6 decimals, convert to 9 for comparison
const BURN_TO_ATOMIC = 1000n;

function formatXess(amount: bigint): string {
  const DECIMALS = 1_000_000n;
  const whole = amount / DECIMALS;
  return whole.toLocaleString();
}

export async function GET() {
  try {
    // Get all burn records
    const burns = await db.burnRecord.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Calculate totals
    const totalBurned6 = burns.reduce((sum, b) => sum + b.amount, 0n);
    const totalBurned9 = totalBurned6 * BURN_TO_ATOMIC;

    // Group by pool
    const byPool = {
      XESSEX: 0n,
      EMBED: 0n,
    };
    for (const b of burns) {
      if (b.pool === "XESSEX") byPool.XESSEX += b.amount;
      else if (b.pool === "EMBED") byPool.EMBED += b.amount;
    }

    // Group by reason
    const byReason: Record<string, bigint> = {};
    for (const b of burns) {
      byReason[b.reason] = (byReason[b.reason] ?? 0n) + b.amount;
    }

    // Calculate percentage of total supply burned
    const burnPercentage = totalBurned9 > 0n
      ? Number((totalBurned9 * 10000n) / TOTAL_SUPPLY_ATOMIC) / 100
      : 0;

    // Recent burns (last 10)
    const recentBurns = burns.slice(0, 10).map((b) => ({
      id: b.id,
      weekKey: b.weekKey,
      pool: b.pool,
      reason: b.reason,
      amount: formatXess(b.amount),
      description: b.description,
      txSig: b.txSig,
      createdAt: b.createdAt.toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      totalBurned: formatXess(totalBurned6),
      totalBurnedAtomic: totalBurned6.toString(),
      totalSupply: "1,000,000,000",
      burnPercentage: burnPercentage.toFixed(4),
      byPool: {
        XESSEX: formatXess(byPool.XESSEX),
        EMBED: formatXess(byPool.EMBED),
      },
      byReason: Object.fromEntries(
        Object.entries(byReason).map(([reason, amount]) => [reason, formatXess(amount)])
      ),
      burnCount: burns.length,
      recentBurns,
    });
  } catch (error) {
    console.error("[burns/summary] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
