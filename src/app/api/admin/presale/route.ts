/**
 * Admin Presale Management API
 *
 * GET  /api/admin/presale - Get sale config and contributions summary
 * POST /api/admin/presale - Update sale config
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";
import { getSolPriceUsd, computeLamportsPerXess } from "@/lib/solPrice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

export async function GET() {
  const ctx = await getAccessContext();

  if (!ctx.isAdminOrMod) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403, headers: noCache }
    );
  }

  try {
    const [cfg, contributions, stats] = await Promise.all([
      db.saleConfig.findFirst(),
      db.saleContribution.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.saleContribution.groupBy({
        by: ["phase", "status", "asset"],
        _sum: {
          xessAmount: true,
          paidLamports: true,
          paidUsdcAtomic: true,
        },
        _count: true,
      }),
    ]);

    if (!cfg) {
      return NextResponse.json(
        { ok: false, error: "no_config" },
        { status: 404, headers: noCache }
      );
    }

    // Calculate totals
    const confirmedStats = stats.filter((s) => s.status === "CONFIRMED");
    const totalXessSold = confirmedStats.reduce(
      (acc, s) => acc + (s._sum.xessAmount ?? 0n),
      0n
    );
    const totalSolLamports = confirmedStats
      .filter((s) => s.asset === "SOL")
      .reduce((acc, s) => acc + (s._sum.paidLamports ?? 0n), 0n);
    const totalUsdcAtomic = confirmedStats
      .filter((s) => s.asset === "USDC")
      .reduce((acc, s) => acc + (s._sum.paidUsdcAtomic ?? 0n), 0n);

    // Format contributions for response
    const formattedContributions = contributions.map((c) => ({
      id: c.id,
      createdAt: c.createdAt.toISOString(),
      phase: c.phase,
      wallet: c.wallet,
      asset: c.asset,
      xessAmount: c.xessAmount.toString(),
      paidLamports: c.paidLamports?.toString() ?? null,
      paidUsdcAtomic: c.paidUsdcAtomic?.toString() ?? null,
      txSig: c.txSig,
      status: c.status,
      confirmedAt: c.confirmedAt?.toISOString() ?? null,
    }));

    return NextResponse.json(
      {
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
          privateLamportsPerXess: cfg.privateLamportsPerXess.toString(),
          publicLamportsPerXess: cfg.publicLamportsPerXess.toString(),
          privateMerkleRootHex: cfg.privateMerkleRootHex,
          privateStartsAt: cfg.privateStartsAt?.toISOString() ?? null,
          privateEndsAt: cfg.privateEndsAt?.toISOString() ?? null,
          publicStartsAt: cfg.publicStartsAt?.toISOString() ?? null,
          publicEndsAt: cfg.publicEndsAt?.toISOString() ?? null,
        },
        totals: {
          xessSold: totalXessSold.toString(),
          solLamports: totalSolLamports.toString(),
          usdcAtomic: totalUsdcAtomic.toString(),
        },
        contributions: formattedContributions,
      },
      { headers: noCache }
    );
  } catch (err) {
    console.error("Admin presale GET error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500, headers: noCache }
    );
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getAccessContext();

  // Only admins can update config (not mods)
  if (ctx.user?.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403, headers: noCache }
    );
  }

  try {
    const body = await req.json();

    const cfg = await db.saleConfig.findFirst();
    if (!cfg) {
      return NextResponse.json(
        { ok: false, error: "no_config" },
        { status: 404, headers: noCache }
      );
    }

    // Build update data from allowed fields
    const updateData: Record<string, unknown> = {};

    if (body.activePhase !== undefined) {
      if (!["private", "public", "closed"].includes(body.activePhase)) {
        return NextResponse.json(
          { ok: false, error: "invalid_phase" },
          { status: 400, headers: noCache }
        );
      }
      updateData.activePhase = body.activePhase;
    }

    // BigInt fields
    const bigIntFields = [
      "walletCapXess",
      "privateAllocation",
      "publicAllocation",
      "privatePriceUsdMicros",
      "publicPriceUsdMicros",
      "privateLamportsPerXess",
      "publicLamportsPerXess",
    ];

    for (const field of bigIntFields) {
      if (body[field] !== undefined) {
        try {
          updateData[field] = BigInt(body[field]);
        } catch {
          return NextResponse.json(
            { ok: false, error: `invalid_${field}` },
            { status: 400, headers: noCache }
          );
        }
      }
    }

    // Date fields
    const dateFields = [
      "privateStartsAt",
      "privateEndsAt",
      "publicStartsAt",
      "publicEndsAt",
    ];

    for (const field of dateFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] ? new Date(body[field]) : null;
      }
    }

    // Merkle root
    if (body.privateMerkleRootHex !== undefined) {
      updateData.privateMerkleRootHex = body.privateMerkleRootHex || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { ok: false, error: "no_updates" },
        { status: 400, headers: noCache }
      );
    }

    await db.saleConfig.update({
      where: { id: cfg.id },
      data: updateData,
    });

    // Auto-compute lamportsPerXess from live SOL price to keep DB fallback fresh
    const solPrice = await getSolPriceUsd();
    if (solPrice && solPrice > 0) {
      const updatedCfg = await db.saleConfig.findFirst();
      if (updatedCfg) {
        const privateLpx = computeLamportsPerXess(updatedCfg.privatePriceUsdMicros, solPrice);
        const publicLpx = computeLamportsPerXess(updatedCfg.publicPriceUsdMicros, solPrice);
        if (privateLpx > 0n && publicLpx > 0n) {
          await db.saleConfig.update({
            where: { id: updatedCfg.id },
            data: {
              privateLamportsPerXess: privateLpx,
              publicLamportsPerXess: publicLpx,
            },
          });
        }
      }
    }

    return NextResponse.json({ ok: true }, { headers: noCache });
  } catch (err) {
    console.error("Admin presale POST error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500, headers: noCache }
    );
  }
}
