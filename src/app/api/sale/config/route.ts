/**
 * Sale Config API
 *
 * GET /api/sale/config
 * Returns public sale configuration and current status
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getSolPriceUsd, computeLamportsPerXess } from "@/lib/solPrice";

export const runtime = "nodejs";

export async function GET() {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  try {
    const cfg = await db.saleConfig.findFirst();
    if (!cfg) {
      return NextResponse.json({ error: "missing_config" }, { status: 500, headers: noCache });
    }

    // Compute live SOL-based lamports from Pyth price
    const solPriceUsd = await getSolPriceUsd();
    let computedPrivateLamportsPerXess: string | null = null;
    let computedPublicLamportsPerXess: string | null = null;

    if (solPriceUsd && solPriceUsd > 0) {
      computedPrivateLamportsPerXess = computeLamportsPerXess(
        cfg.privatePriceUsdMicros,
        solPriceUsd,
      ).toString();
      computedPublicLamportsPerXess = computeLamportsPerXess(
        cfg.publicPriceUsdMicros,
        solPriceUsd,
      ).toString();
    }

    return NextResponse.json({
      ok: true,
      activePhase: cfg.activePhase,
      totalSupplyXess: cfg.totalSupplyXess.toString(),
      saleAllocationXess: cfg.saleAllocationXess.toString(),
      privateAllocation: cfg.privateAllocation.toString(),
      publicAllocation: cfg.publicAllocation.toString(),
      walletCapXess: cfg.walletCapXess.toString(),
      soldPrivateXess: cfg.soldPrivateXess.toString(),
      soldPublicXess: cfg.soldPublicXess.toString(),
      privatePriceUsdMicros: cfg.privatePriceUsdMicros.toString(),
      publicPriceUsdMicros: cfg.publicPriceUsdMicros.toString(),
      privateLamportsPerXess: cfg.privateLamportsPerXess.toString(),
      publicLamportsPerXess: cfg.publicLamportsPerXess.toString(),
      solPriceUsd: solPriceUsd ?? null,
      computedPrivateLamportsPerXess,
      computedPublicLamportsPerXess,
      privateStartsAt: cfg.privateStartsAt?.toISOString() ?? null,
      privateEndsAt: cfg.privateEndsAt?.toISOString() ?? null,
      publicStartsAt: cfg.publicStartsAt?.toISOString() ?? null,
      publicEndsAt: cfg.publicEndsAt?.toISOString() ?? null,
      acceptedAssets: ["SOL", "USDC"],
    }, { headers: noCache });
  } catch (err) {
    console.error("Sale config error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500, headers: noCache });
  }
}
