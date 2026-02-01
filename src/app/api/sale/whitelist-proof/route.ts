/**
 * Whitelist Proof API
 *
 * GET /api/sale/whitelist-proof?wallet=...
 * Returns Merkle proof for private sale whitelist verification
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

type WhitelistData = {
  root: string;
  proofs: Record<string, string[]>;
};

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

    // Try to read the whitelist file
    const whitelistPath = path.join(process.cwd(), "private", "whitelist.merkle.json");

    if (!fs.existsSync(whitelistPath)) {
      return NextResponse.json({
        ok: true,
        rootHex: cfg.privateMerkleRootHex,
        proofHex: null,
        whitelisted: false,
      }, { headers: noCache });
    }

    const data: WhitelistData = JSON.parse(fs.readFileSync(whitelistPath, "utf8"));
    const proof = data.proofs[wallet] || null;

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
