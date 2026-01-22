/**
 * Debug endpoint for claim tree verification.
 *
 * GET /api/admin/debug/claim-tree
 *   - Lists all epochs with status
 *   - Shows leaf count and root
 *
 * GET /api/admin/debug/claim-tree?wallet=<base58>
 *   - Looks up wallet in latest on-chain epoch
 *   - Returns leaf details and verifies proof
 *
 * GET /api/admin/debug/claim-tree?epoch=<n>&wallet=<base58>
 *   - Looks up wallet in specific epoch
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import {
  leafHash,
  fromHex32,
  verifyProof,
  toHex32,
} from "@/lib/merkleSha256";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function u64LE(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

async function getOnChainRoot(epoch: bigint): Promise<{ found: boolean; rootHex?: string; error?: string }> {
  try {
    const programId = new PublicKey(process.env.NEXT_PUBLIC_XESS_CLAIM_PROGRAM_ID!);
    const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpc, "confirmed");

    const [epochRootPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("epoch_root"), u64LE(epoch)],
      programId
    );

    const accountInfo = await connection.getAccountInfo(epochRootPda);
    if (!accountInfo) {
      return { found: false, error: "epoch_root PDA not found on-chain" };
    }

    // EpochRoot account layout (from Anchor):
    // 8 bytes discriminator + 8 bytes epoch + 32 bytes root
    if (accountInfo.data.length < 48) {
      return { found: false, error: `unexpected account size: ${accountInfo.data.length}` };
    }

    const rootBytes = accountInfo.data.slice(16, 48); // skip discriminator + epoch
    return { found: true, rootHex: Buffer.from(rootBytes).toString("hex") };
  } catch (e) {
    return { found: false, error: e instanceof Error ? e.message : "unknown error" };
  }
}

export async function GET(req: NextRequest) {
  // Auth check - must be admin
  const ctx = await getAccessContext();
  if (!ctx.isAdminOrMod) {
    return NextResponse.json({ error: "admin_required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const walletParam = searchParams.get("wallet")?.trim();
  const epochParam = searchParams.get("epoch");
  const verifyOnChain = searchParams.get("verify") === "true";

  // Get all epochs
  const allEpochs = await db.claimEpoch.findMany({
    orderBy: { epoch: "desc" },
    take: 10,
  });

  // Find the target epoch
  let targetEpoch = epochParam
    ? allEpochs.find(e => e.epoch === parseInt(epochParam, 10))
    : allEpochs.find(e => e.setOnChain); // latest on-chain

  // If no specific epoch requested and none on-chain, use latest
  if (!targetEpoch && !epochParam) {
    targetEpoch = allEpochs[0];
  }

  const result: Record<string, unknown> = {
    ok: true,
    epochs: allEpochs.map(e => ({
      epoch: e.epoch,
      weekKey: e.weekKey,
      rootHex: e.rootHex,
      leafCount: e.leafCount,
      totalAtomic: e.totalAtomic.toString(),
      setOnChain: e.setOnChain,
      createdAt: e.createdAt.toISOString(),
    })),
    targetEpoch: targetEpoch
      ? {
          epoch: targetEpoch.epoch,
          weekKey: targetEpoch.weekKey,
          rootHex: targetEpoch.rootHex,
          leafCount: targetEpoch.leafCount,
          setOnChain: targetEpoch.setOnChain,
        }
      : null,
  };

  // Verify on-chain root if requested
  if (targetEpoch && verifyOnChain) {
    const onChain = await getOnChainRoot(BigInt(targetEpoch.epoch));
    result.onChainRoot = onChain;

    if (onChain.found && onChain.rootHex) {
      result.rootMatch = onChain.rootHex.toLowerCase() === targetEpoch.rootHex.toLowerCase();
      if (!result.rootMatch) {
        result.rootMismatchWarning = "DB root does not match on-chain root! Proofs will fail.";
      }
    }
  }

  // Wallet lookup
  if (walletParam && targetEpoch) {
    const leaf = await db.claimLeaf.findUnique({
      where: { epoch_wallet: { epoch: targetEpoch.epoch, wallet: walletParam } },
    });

    if (!leaf) {
      // Check if wallet exists in any epoch
      const anyLeaf = await db.claimLeaf.findFirst({
        where: { wallet: walletParam },
        orderBy: { epoch: "desc" },
      });

      result.walletLookup = {
        found: false,
        wallet: walletParam,
        epochSearched: targetEpoch.epoch,
        hint: anyLeaf
          ? `Wallet found in epoch ${anyLeaf.epoch} (weekKey: ${anyLeaf.weekKey})`
          : "Wallet not found in any epoch",
      };
    } else {
      // Verify the proof locally
      const leafBuf = leafHash({
        wallet: leaf.wallet,
        epoch: BigInt(leaf.epoch),
        amountAtomic: leaf.amountAtomic,
        index: leaf.index,
      });

      const proofHex = leaf.proofHex as string[];
      const proofBufs = proofHex.map(fromHex32);
      const rootBuf = fromHex32(targetEpoch.rootHex);

      const proofValid = verifyProof(leafBuf, proofBufs, rootBuf, leaf.index);

      result.walletLookup = {
        found: true,
        wallet: leaf.wallet,
        epoch: leaf.epoch,
        weekKey: leaf.weekKey,
        index: leaf.index,
        amountAtomic: leaf.amountAtomic.toString(),
        amountDisplay: (Number(leaf.amountAtomic) / 1e9).toFixed(4),
        proofLength: proofHex.length,
        leafHash: toHex32(leafBuf),
        proofValid,
        proofValidAgainstRoot: targetEpoch.rootHex,
        proofError: proofValid ? null : "Proof does NOT verify against stored root. Tree may be corrupted.",
      };
    }
  }

  // Sample leaves from target epoch
  if (targetEpoch) {
    const sampleLeaves = await db.claimLeaf.findMany({
      where: { epoch: targetEpoch.epoch },
      take: 5,
      orderBy: { index: "asc" },
    });

    result.sampleLeaves = sampleLeaves.map(l => ({
      index: l.index,
      wallet: l.wallet.slice(0, 8) + "..." + l.wallet.slice(-4),
      amountAtomic: l.amountAtomic.toString(),
      amountDisplay: (Number(l.amountAtomic) / 1e9).toFixed(4),
    }));
  }

  return NextResponse.json(result);
}
