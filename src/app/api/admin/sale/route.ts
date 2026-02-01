/**
 * Admin Sale Config API
 *
 * GET /api/admin/sale - Get full sale config
 * PATCH /api/admin/sale - Update sale config (phase, prices, dates)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

export async function GET() {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  const access = await getAccessContext();
  if (!access.isAdminOrMod) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noCache });
  }

  const cfg = await db.saleConfig.findFirst();
  if (!cfg) {
    return NextResponse.json({ error: "missing_config" }, { status: 500, headers: noCache });
  }

  // Get contribution stats
  const stats = await db.saleContribution.groupBy({
    by: ["phase", "status"],
    _sum: { xessAmount: true },
    _count: true,
  });

  return NextResponse.json({
    ok: true,
    config: {
      id: cfg.id,
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
      privateMerkleRootHex: cfg.privateMerkleRootHex,
      privateStartsAt: cfg.privateStartsAt?.toISOString() ?? null,
      privateEndsAt: cfg.privateEndsAt?.toISOString() ?? null,
      publicStartsAt: cfg.publicStartsAt?.toISOString() ?? null,
      publicEndsAt: cfg.publicEndsAt?.toISOString() ?? null,
      updatedAt: cfg.updatedAt.toISOString(),
    },
    stats: stats.map((s) => ({
      phase: s.phase,
      status: s.status,
      count: s._count,
      xessAmount: (s._sum.xessAmount ?? 0n).toString(),
    })),
  }, { headers: noCache });
}

export async function PATCH(req: NextRequest) {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  const access = await getAccessContext();
  if (!access.isAdminOrMod) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noCache });
  }

  try {
    const body = await req.json();
    const cfg = await db.saleConfig.findFirst();

    if (!cfg) {
      return NextResponse.json({ error: "missing_config" }, { status: 500, headers: noCache });
    }

    const updateData: Record<string, unknown> = {};

    // Phase
    if (body.activePhase && ["private", "public", "closed"].includes(body.activePhase)) {
      updateData.activePhase = body.activePhase;
    }

    // Prices
    if (body.privatePriceUsdMicros !== undefined) {
      updateData.privatePriceUsdMicros = BigInt(body.privatePriceUsdMicros);
    }
    if (body.publicPriceUsdMicros !== undefined) {
      updateData.publicPriceUsdMicros = BigInt(body.publicPriceUsdMicros);
    }

    // Wallet cap
    if (body.walletCapXess !== undefined) {
      updateData.walletCapXess = BigInt(body.walletCapXess);
    }

    // Time gates
    if (body.privateStartsAt !== undefined) {
      updateData.privateStartsAt = body.privateStartsAt ? new Date(body.privateStartsAt) : null;
    }
    if (body.privateEndsAt !== undefined) {
      updateData.privateEndsAt = body.privateEndsAt ? new Date(body.privateEndsAt) : null;
    }
    if (body.publicStartsAt !== undefined) {
      updateData.publicStartsAt = body.publicStartsAt ? new Date(body.publicStartsAt) : null;
    }
    if (body.publicEndsAt !== undefined) {
      updateData.publicEndsAt = body.publicEndsAt ? new Date(body.publicEndsAt) : null;
    }

    // Merkle root
    if (body.privateMerkleRootHex !== undefined) {
      updateData.privateMerkleRootHex = body.privateMerkleRootHex || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "no_updates" }, { status: 400, headers: noCache });
    }

    const updated = await db.saleConfig.update({
      where: { id: cfg.id },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      config: {
        activePhase: updated.activePhase,
        privatePriceUsdMicros: updated.privatePriceUsdMicros.toString(),
        publicPriceUsdMicros: updated.publicPriceUsdMicros.toString(),
        walletCapXess: updated.walletCapXess.toString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    }, { headers: noCache });
  } catch (err) {
    console.error("Admin sale update error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500, headers: noCache });
  }
}
