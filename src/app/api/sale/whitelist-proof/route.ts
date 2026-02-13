/**
 * Whitelist Proof API
 *
 * GET /api/sale/whitelist-proof?wallet=...
 * Returns Merkle proof for private sale whitelist verification
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
    if (!cfg?.privateMerkleRootHex) {
      return NextResponse.json({
        ok: true,
        rootHex: null,
        proofHex: null,
        whitelisted: false,
      }, { headers: noCache });
    }

    if (!cfg.privateMerkleProofsJson) {
      return NextResponse.json({
        ok: true,
        rootHex: cfg.privateMerkleRootHex,
        proofHex: null,
        whitelisted: false,
      }, { headers: noCache });
    }

    const proofs: Record<string, string[]> = JSON.parse(cfg.privateMerkleProofsJson);
    const proof = proofs[wallet] || null;

    return NextResponse.json({
      ok: true,
      rootHex: cfg.privateMerkleRootHex,
      proofHex: proof,
      whitelisted: proof !== null,
    }, { headers: noCache });
  } catch (err) {
    console.error("Whitelist proof error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500, headers: noCache });
  }
}
