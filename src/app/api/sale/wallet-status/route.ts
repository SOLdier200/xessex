/**
 * Wallet Sale Status API
 *
 * GET /api/sale/wallet-status?wallet=...
 * Returns wallet's contribution status and remaining cap
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };
  const wallet = (req.nextUrl.searchParams.get("wallet") || "").toLowerCase();

  if (!wallet) {
    return NextResponse.json({ error: "missing_wallet" }, { status: 400, headers: noCache });
  }

  try {
    const cfg = await db.saleConfig.findFirst();
    if (!cfg) {
      return NextResponse.json({ error: "missing_config" }, { status: 500, headers: noCache });
    }

    // Get total contributions for this wallet
    const contributions = await db.saleContribution.aggregate({
      where: {
        wallet,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      _sum: { xessAmount: true },
    });

    const totalAllocated = contributions._sum.xessAmount ?? BigInt(0);
    const remaining = cfg.walletCapXess - totalAllocated;

    // Get individual contributions
    const history = await db.saleContribution.findMany({
      where: { wallet },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      ok: true,
      wallet,
      walletCapXess: cfg.walletCapXess.toString(),
      totalAllocatedXess: totalAllocated.toString(),
      remainingCapXess: (remaining > 0n ? remaining : 0n).toString(),
      atCap: remaining <= 0n,
      contributions: history.map((c) => ({
        id: c.id,
        phase: c.phase,
        asset: c.asset,
        xessAmount: c.xessAmount.toString(),
        paidLamports: c.paidLamports?.toString() ?? null,
        paidUsdcAtomic: c.paidUsdcAtomic?.toString() ?? null,
        txSig: c.txSig,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
    }, { headers: noCache });
  } catch (err) {
    console.error("Wallet status error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500, headers: noCache });
  }
}
