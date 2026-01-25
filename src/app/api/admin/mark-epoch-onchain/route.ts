/**
 * Admin endpoint to mark a ClaimEpoch as set on-chain.
 *
 * SAFE VERSION: Fetches EpochRoot PDA from chain, parses the account,
 * and verifies the on-chain root matches DB before marking setOnChain=true.
 *
 * Called after manually running set-epoch-root.mjs CLI.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";
import { Connection, PublicKey } from "@solana/web3.js";

export const runtime = "nodejs";

const RPC_URL = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_XESS_CLAIM_PROGRAM_ID || "AKRLZssgxwQwC2gGgUtYtcU7JrhDyEfk1FHqQkZnFUax");

function cleanHex(hex: string) {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]{64}$/.test(h)) throw new Error("Invalid rootHex (expected 32-byte hex)");
  return h.toLowerCase();
}

function deriveEpochRootPda(epoch: number) {
  const epochBuf = Buffer.alloc(8);
  epochBuf.writeBigUInt64LE(BigInt(epoch));
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("epoch_root"), epochBuf], PROGRAM_ID);
  return pda;
}

/**
 * Parses Anchor account data for EpochRoot:
 * discriminator(8) + epoch(8 LE) + root(32) + bump(1)
 */
function parseEpochRootAccount(data: Buffer) {
  if (data.length < 49) throw new Error(`EpochRoot account too small: ${data.length} bytes (expected >= 49)`);
  const disc = data.subarray(0, 8); // discriminator (not used, kept for clarity)
  const epoch = Number(data.readBigUInt64LE(8)); // at offset 8
  const root = data.subarray(16, 48); // 32 bytes: 8(discriminator)+8(epoch)=16
  const bump = data.readUInt8(48);
  return { disc, epoch, root, bump };
}

export async function POST(req: NextRequest) {
  try {
    const access = await getAccessContext();
    if (!access.isAdminOrMod) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const epoch = body?.epoch;
    const txSig = typeof body?.txSig === "string" ? body.txSig : null;

    if (typeof epoch !== "number" || !Number.isInteger(epoch) || epoch < 0) {
      return NextResponse.json({ ok: false, error: "INVALID_EPOCH" }, { status: 400 });
    }

    // Load DB epoch first
    const ce = await db.claimEpoch.findUnique({
      where: { epoch },
      select: { epoch: true, rootHex: true, setOnChain: true, onChainTxSig: true },
    });

    if (!ce) {
      return NextResponse.json({ ok: false, error: "EPOCH_NOT_FOUND" }, { status: 404 });
    }

    // If already marked on-chain, no-op (idempotent)
    if (ce.setOnChain) {
      return NextResponse.json({
        ok: true,
        epoch: ce.epoch,
        setOnChain: true,
        alreadySet: true,
        txSig: ce.onChainTxSig,
      });
    }

    const expectedRootHex = cleanHex(ce.rootHex);

    // Fetch on-chain EpochRoot PDA account
    const connection = new Connection(RPC_URL, "confirmed");
    const epochRootPda = deriveEpochRootPda(epoch);

    console.log("[mark-epoch-onchain] Checking PDA:", epochRootPda.toBase58());
    console.log("[mark-epoch-onchain] Expected root:", "0x" + expectedRootHex);

    const acctInfo = await connection.getAccountInfo(epochRootPda, "confirmed");
    if (!acctInfo) {
      return NextResponse.json(
        {
          ok: false,
          error: "EPOCH_ROOT_NOT_SET",
          message: "EpochRoot PDA does not exist on-chain. Run set-epoch-root.mjs first.",
          epoch,
          epochRootPda: epochRootPda.toBase58(),
        },
        { status: 400 }
      );
    }

    // Ensure owner is the program
    if (!acctInfo.owner.equals(PROGRAM_ID)) {
      return NextResponse.json(
        {
          ok: false,
          error: "EPOCH_ROOT_BAD_OWNER",
          message: "EpochRoot PDA owned by wrong program",
          owner: acctInfo.owner.toBase58(),
          expected: PROGRAM_ID.toBase58(),
        },
        { status: 400 }
      );
    }

    const parsed = parseEpochRootAccount(Buffer.from(acctInfo.data));
    if (parsed.epoch !== epoch) {
      return NextResponse.json(
        {
          ok: false,
          error: "EPOCH_ROOT_EPOCH_MISMATCH",
          message: "On-chain epoch number doesn't match",
          expected: epoch,
          got: parsed.epoch,
        },
        { status: 400 }
      );
    }

    const onChainRootHex = Buffer.from(parsed.root).toString("hex").toLowerCase();

    console.log("[mark-epoch-onchain] On-chain root:", "0x" + onChainRootHex);

    if (onChainRootHex !== expectedRootHex) {
      return NextResponse.json(
        {
          ok: false,
          error: "ROOT_MISMATCH",
          message: "On-chain root does not match DB root. Epoch may have been rebuilt after on-chain publish.",
          epoch,
          expectedRootHex: "0x" + expectedRootHex,
          onChainRootHex: "0x" + onChainRootHex,
          epochRootPda: epochRootPda.toBase58(),
        },
        { status: 409 }
      );
    }

    // Roots match → mark on-chain in DB
    const updated = await db.claimEpoch.update({
      where: { epoch },
      data: {
        setOnChain: true,
        onChainTxSig: txSig,
        setOnChainAt: new Date(),
      },
      select: { epoch: true, setOnChain: true, onChainTxSig: true },
    });

    console.log("[mark-epoch-onchain] SUCCESS - epoch", epoch, "marked on-chain");

    return NextResponse.json({
      ok: true,
      epoch: updated.epoch,
      setOnChain: updated.setOnChain,
      txSig: updated.onChainTxSig,
      epochRootPda: epochRootPda.toBase58(),
    });
  } catch (err: any) {
    console.error("[mark-epoch-onchain] Error:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
