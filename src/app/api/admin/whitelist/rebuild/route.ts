/**
 * Rebuild Merkle Tree from DB whitelist
 *
 * POST /api/admin/whitelist/rebuild
 * Reads all wallets from SaleWhitelist, builds Merkle tree,
 * stores proofs in SaleConfig, and updates the root.
 */

import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";

const noCache = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
};

function sha256(data: Buffer): Buffer {
  return crypto.createHash("sha256").update(data).digest();
}

function hashPair(a: Buffer, b: Buffer): Buffer {
  const [x, y] = Buffer.compare(a, b) <= 0 ? [a, b] : [b, a];
  return crypto.createHash("sha256").update(Buffer.concat([x, y])).digest();
}

function buildMerkle(leaves: Buffer[]): { root: Buffer; layers: Buffer[][] } {
  if (leaves.length === 0) throw new Error("No leaves");
  let level = leaves.slice();
  const layers: Buffer[][] = [level];

  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      next.push(hashPair(left, right));
    }
    level = next;
    layers.push(level);
  }

  return { root: layers[layers.length - 1][0], layers };
}

function getProof(index: number, layers: Buffer[][]): Buffer[] {
  const proof: Buffer[] = [];
  let idx = index;

  for (let l = 0; l < layers.length - 1; l++) {
    const layer = layers[l];
    const pairIdx = idx ^ 1;
    proof.push(layer[pairIdx] ?? layer[idx]);
    idx = Math.floor(idx / 2);
  }

  return proof;
}

export async function POST() {
  const ctx = await getAccessContext();
  if (ctx.user?.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403, headers: noCache }
    );
  }

  try {
    const entries = await db.saleWhitelist.findMany();
    const wallets = entries.map((e) => e.wallet.toLowerCase());

    if (wallets.length === 0) {
      // Clear merkle root and proofs if no wallets
      const cfg = await db.saleConfig.findFirst();
      if (cfg) {
        await db.saleConfig.update({
          where: { id: cfg.id },
          data: { privateMerkleRootHex: null, privateMerkleProofsJson: null },
        });
      }

      return NextResponse.json(
        { ok: true, walletCount: 0, rootHex: null },
        { headers: noCache }
      );
    }

    // Build leaves
    const leaves = wallets.map((w) => sha256(Buffer.from(w)));
    const { root, layers } = buildMerkle(leaves);

    // Generate proofs
    const proofs: Record<string, string[]> = {};
    wallets.forEach((w, i) => {
      proofs[w] = getProof(i, layers).map((b) => b.toString("hex"));
    });

    const rootHex = root.toString("hex");

    // Store root and proofs in DB
    const cfg = await db.saleConfig.findFirst();
    if (cfg) {
      await db.saleConfig.update({
        where: { id: cfg.id },
        data: {
          privateMerkleRootHex: rootHex,
          privateMerkleProofsJson: JSON.stringify(proofs),
        },
      });
    }

    return NextResponse.json(
      { ok: true, walletCount: wallets.length, rootHex },
      { headers: noCache }
    );
  } catch (err) {
    console.error("Whitelist rebuild error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500, headers: noCache }
    );
  }
}
