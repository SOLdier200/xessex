import { NextResponse } from "next/server";
import { z } from "zod";
import { Connection } from "@solana/web3.js";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

// Solana signatures are base58-encoded 64 bytes = typically 87-88 chars
const SOLANA_SIG_REGEX = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

// Server-side RPC URL (fallback to public mainnet)
const RPC_URL = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// Program ID for XESS claims (set this once deployed)
const CLAIM_PROGRAM_ID = process.env.XESS_CLAIM_PROGRAM_ID || null;

const Body = z.object({
  claimId: z.string().min(10),
  txSig: z.string().min(20),
});

/**
 * Verify transaction on-chain
 * Returns: { ok: true } or { ok: false, error: string }
 */
async function verifyTransaction(txSig: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const connection = new Connection(RPC_URL, "confirmed");

    // Get signature status
    const statuses = await connection.getSignatureStatuses([txSig]);
    const status = statuses.value[0];

    if (!status) {
      return { ok: false, error: "TX_NOT_FOUND" };
    }

    if (status.err) {
      return { ok: false, error: "TX_FAILED" };
    }

    // Check confirmation level
    if (status.confirmationStatus !== "finalized" && status.confirmationStatus !== "confirmed") {
      return { ok: false, error: "TX_NOT_CONFIRMED" };
    }

    // If we have a program ID, verify it's in the transaction
    if (CLAIM_PROGRAM_ID) {
      const tx = await connection.getTransaction(txSig, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        return { ok: false, error: "TX_NOT_FOUND" };
      }

      // Check if our program is in the account keys
      const accountKeys = tx.transaction.message.staticAccountKeys?.map(k => k.toBase58()) || [];

      // For versioned transactions, also check address table lookups
      if ("addressTableLookups" in tx.transaction.message) {
        // Versioned transaction - accountKeys already includes resolved addresses
      }

      if (!accountKeys.includes(CLAIM_PROGRAM_ID)) {
        return { ok: false, error: "TX_WRONG_PROGRAM" };
      }
    }

    return { ok: true };
  } catch (err) {
    console.error("[CLAIM_COMPLETE] RPC error:", err);
    // On RPC error, fail safe - don't mark as claimed
    return { ok: false, error: "RPC_ERROR" };
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userId = user.id;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { claimId, txSig } = parsed.data;

  // Validate txSig format (base58, 87-88 chars)
  if (!SOLANA_SIG_REGEX.test(txSig)) {
    return NextResponse.json({ ok: false, error: "INVALID_TX_SIGNATURE" }, { status: 400 });
  }

  // Find the claim
  const claim = await db.rewardClaim.findUnique({ where: { id: claimId } });
  if (!claim || claim.userId !== userId) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  // Idempotent: if already CLAIMED with same txSig, return ok
  if (claim.status === "CLAIMED") {
    return NextResponse.json({ ok: true, status: "CLAIMED", txSig: claim.txSig });
  }

  // Check if txSig is already used (it's @unique)
  const existingTx = await db.rewardClaim.findUnique({ where: { txSig } });
  if (existingTx && existingTx.id !== claimId) {
    return NextResponse.json({ ok: false, error: "TX_ALREADY_USED" }, { status: 400 });
  }

  // Verify transaction on-chain
  const verification = await verifyTransaction(txSig);
  if (!verification.ok) {
    // Mark as FAILED with error
    await db.rewardClaim.update({
      where: { id: claimId },
      data: {
        status: "FAILED",
        error: verification.error,
      },
    });
    return NextResponse.json({ ok: false, error: verification.error }, { status: 400 });
  }

  // Mark as CLAIMED
  const updated = await db.rewardClaim.update({
    where: { id: claimId },
    data: {
      status: "CLAIMED",
      txSig,
      claimedAt: new Date(),
      error: null,
    },
  });

  return NextResponse.json({ ok: true, status: updated.status, txSig: updated.txSig });
}
