/**
 * GET /api/admin/burns
 * Admin endpoint to get all burn records
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS ?? "").split(",").filter(Boolean);

function formatXess(amount: bigint): string {
  const DECIMALS = 1_000_000n;
  const whole = amount / DECIMALS;
  const frac = amount % DECIMALS;
  if (frac === 0n) return whole.toLocaleString();
  return `${whole.toLocaleString()}.${frac.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (!user.walletAddress || !ADMIN_WALLETS.includes(user.walletAddress)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    // Get all burn records
    const burns = await db.burnRecord.findMany({
      orderBy: { createdAt: "desc" },
    });

    const formattedBurns = burns.map((b) => ({
      id: b.id,
      weekKey: b.weekKey,
      pool: b.pool,
      reason: b.reason,
      amount: formatXess(b.amount),
      amountAtomic: b.amount.toString(),
      description: b.description,
      txSig: b.txSig,
      createdAt: b.createdAt.toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      burns: formattedBurns,
      count: burns.length,
    });
  } catch (error) {
    console.error("[admin/burns] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
