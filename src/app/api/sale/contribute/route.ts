/**
 * Sale Contribution API
 *
 * POST /api/sale/contribute
 * Submit a contribution to the token sale with on-chain verification
 *
 * Body: {
 *   phase: "private" | "public",
 *   asset: "SOL" | "USDC",
 *   xessAmount: string,
 *   txSig: string,
 *   whitelistProofHex?: string[]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { getSolPriceUsd, computeLamportsPerXess } from "@/lib/solPrice";
import crypto from "crypto";

export const runtime = "nodejs";

// Environment configuration
const TREASURY_WALLET = process.env.PRESALE_TREASURY_WALLET!;
const USDC_ATA = process.env.PRESALE_USDC_ATA!;
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const MAX_TX_AGE_SECONDS = Number(process.env.PRESALE_TX_MAX_AGE_SECONDS || "600");

type Asset = "SOL" | "USDC";
type Phase = "private" | "public";

// Merkle verification helpers
function hexToBytes(hex: string): Buffer {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Buffer.from(clean, "hex");
}

function sha256(data: Buffer): Buffer {
  return crypto.createHash("sha256").update(data).digest();
}

function verifyMerkleProof(wallet: string, rootHex: string, proofHex: string[]): boolean {
  let acc = sha256(Buffer.from(wallet.toLowerCase()));

  for (const p of proofHex) {
    const pb = hexToBytes(p);
    const [x, y] = Buffer.compare(acc, pb) <= 0 ? [acc, pb] : [pb, acc];
    acc = sha256(Buffer.concat([x, y]));
  }

  return acc.toString("hex") === rootHex.toLowerCase().replace(/^0x/, "");
}

// On-chain verification helpers
async function getTxAgeSeconds(connection: Connection, sig: string): Promise<number | null> {
  const tx = await connection.getParsedTransaction(sig, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx?.blockTime) return null;
  const now = Math.floor(Date.now() / 1000);
  return now - tx.blockTime;
}

function isSystemTransferTo(
  parsedTx: Awaited<ReturnType<Connection["getParsedTransaction"]>>,
  to: string,
  from: string,
  minLamports: bigint
): boolean {
  const msg = parsedTx?.transaction?.message;
  if (!msg?.instructions) return false;

  for (const ix of msg.instructions) {
    if ("program" in ix && ix.program === "system" && "parsed" in ix && ix.parsed?.type === "transfer") {
      const info = ix.parsed.info;
      if (
        info?.destination === to &&
        info?.source === from &&
        BigInt(info?.lamports ?? 0) >= minLamports
      ) {
        return true;
      }
    }
  }
  return false;
}

function isSplTransferTo(
  parsedTx: Awaited<ReturnType<Connection["getParsedTransaction"]>>,
  destAta: string,
  fromWallet: string,
  minAtomic: bigint
): boolean {
  const msg = parsedTx?.transaction?.message;
  if (!msg?.instructions) return false;

  for (const ix of msg.instructions) {
    if ("program" in ix && ix.program === "spl-token" && "parsed" in ix) {
      const t = ix.parsed?.type;
      const info = ix.parsed?.info;

      if ((t === "transfer" || t === "transferChecked") && info?.destination === destAta) {
        const authority = info?.authority || info?.sourceAuthority;
        const amount = BigInt(info?.amount ?? 0);

        if (authority === fromWallet && amount >= minAtomic) return true;
      }
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  // Require authenticated session with wallet
  const access = await getAccessContext();
  if (!access.user || !access.walletAddress) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: noCache });
  }

  const sessionWallet = access.walletAddress;

  try {
    const body = await req.json();
    const phase = body.phase as Phase;
    const asset = (body.asset as string)?.toUpperCase() as Asset;
    const txSig = String(body?.txSig ?? "").trim();
    const whitelistProofHex = body?.whitelistProofHex as string[] | null;

    let xessAmount: bigint;
    try {
      xessAmount = BigInt(body?.xessAmount ?? 0);
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_xess_amount" }, { status: 400, headers: noCache });
    }

    if (!txSig) {
      return NextResponse.json({ ok: false, error: "missing_tx_sig" }, { status: 400, headers: noCache });
    }

    if (phase !== "private" && phase !== "public") {
      return NextResponse.json({ ok: false, error: "invalid_phase" }, { status: 400, headers: noCache });
    }

    if (asset !== "SOL" && asset !== "USDC") {
      return NextResponse.json({ ok: false, error: "invalid_asset" }, { status: 400, headers: noCache });
    }

    if (xessAmount <= 0n) {
      return NextResponse.json({ ok: false, error: "amount_must_be_positive" }, { status: 400, headers: noCache });
    }

    // Get sale config
    const cfg = await db.saleConfig.findFirst();
    if (!cfg) {
      return NextResponse.json({ ok: false, error: "sale_not_configured" }, { status: 500, headers: noCache });
    }

    // Check phase matches active phase
    if (cfg.activePhase !== phase) {
      return NextResponse.json({ ok: false, error: "phase_not_active" }, { status: 409, headers: noCache });
    }

    // Check time gates
    const now = new Date();
    if (phase === "private") {
      if (cfg.privateStartsAt && now < cfg.privateStartsAt) {
        return NextResponse.json({ ok: false, error: "private_not_started" }, { status: 400, headers: noCache });
      }
      if (cfg.privateEndsAt && now > cfg.privateEndsAt) {
        return NextResponse.json({ ok: false, error: "private_ended" }, { status: 400, headers: noCache });
      }
    } else {
      if (cfg.publicStartsAt && now < cfg.publicStartsAt) {
        return NextResponse.json({ ok: false, error: "public_not_started" }, { status: 400, headers: noCache });
      }
      if (cfg.publicEndsAt && now > cfg.publicEndsAt) {
        return NextResponse.json({ ok: false, error: "public_ended" }, { status: 400, headers: noCache });
      }
    }

    // Private whitelist enforcement
    if (phase === "private" && cfg.privateMerkleRootHex) {
      if (!whitelistProofHex || whitelistProofHex.length === 0) {
        return NextResponse.json({ ok: false, error: "missing_whitelist_proof" }, { status: 403, headers: noCache });
      }

      const verified = verifyMerkleProof(sessionWallet, cfg.privateMerkleRootHex, whitelistProofHex);
      if (!verified) {
        return NextResponse.json({ ok: false, error: "not_whitelisted" }, { status: 403, headers: noCache });
      }
    }

    // Check wallet cap
    const existing = await db.saleContribution.aggregate({
      where: {
        wallet: sessionWallet.toLowerCase(),
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      _sum: { xessAmount: true },
    });

    const alreadyAllocated = existing._sum.xessAmount ?? 0n;
    if (alreadyAllocated + xessAmount > cfg.walletCapXess) {
      return NextResponse.json({
        ok: false,
        error: "cap_exceeded",
        cap: cfg.walletCapXess.toString(),
        used: alreadyAllocated.toString(),
      }, { status: 400, headers: noCache });
    }

    // Check phase allocation remaining
    const remaining = phase === "private"
      ? cfg.privateAllocation - cfg.soldPrivateXess
      : cfg.publicAllocation - cfg.soldPublicXess;

    if (xessAmount > remaining) {
      return NextResponse.json({ ok: false, error: "sold_out" }, { status: 409, headers: noCache });
    }

    // Compute required payment
    const priceUsdMicros = phase === "private" ? cfg.privatePriceUsdMicros : cfg.publicPriceUsdMicros;

    // For SOL: use live Pyth price, fall back to DB value if unavailable
    let requiredLamports: bigint;
    const solPrice = await getSolPriceUsd();
    if (solPrice && solPrice > 0) {
      const liveLamportsPerXess = computeLamportsPerXess(priceUsdMicros, solPrice);
      requiredLamports = liveLamportsPerXess * xessAmount;
    } else {
      // Fallback to stored DB value
      requiredLamports = phase === "private"
        ? cfg.privateLamportsPerXess * xessAmount
        : cfg.publicLamportsPerXess * xessAmount;
    }

    // Apply 3% slippage tolerance for SOL payments
    const minAcceptableLamports = requiredLamports * 9700n / 10000n;

    const requiredUsdcAtomic = (priceUsdMicros * xessAmount) / 1_000_000n;

    // On-chain verification
    const connection = new Connection(RPC_URL, "confirmed");

    // Check tx age
    const age = await getTxAgeSeconds(connection, txSig);
    if (age === null || age < 0 || age > MAX_TX_AGE_SECONDS) {
      return NextResponse.json({ ok: false, error: "tx_too_old_or_unconfirmed" }, { status: 400, headers: noCache });
    }

    // Load and parse transaction
    const parsedTx = await connection.getParsedTransaction(txSig, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });

    if (!parsedTx) {
      return NextResponse.json({ ok: false, error: "tx_not_found" }, { status: 400, headers: noCache });
    }

    // Verify payment instruction (SOL uses slippage-tolerant minimum)
    const paymentVerified = asset === "SOL"
      ? isSystemTransferTo(parsedTx, TREASURY_WALLET, sessionWallet, minAcceptableLamports)
      : isSplTransferTo(parsedTx, USDC_ATA, sessionWallet, requiredUsdcAtomic);

    if (!paymentVerified) {
      return NextResponse.json({ ok: false, error: "payment_not_verified" }, { status: 400, headers: noCache });
    }

    // Check if txSig already used
    const existingTx = await db.saleContribution.findFirst({ where: { txSig } });
    if (existingTx) {
      return NextResponse.json({ ok: false, error: "tx_already_used" }, { status: 409, headers: noCache });
    }

    // Record contribution and update sold counters in a transaction
    await db.$transaction(async (tx) => {
      await tx.saleContribution.create({
        data: {
          phase,
          wallet: sessionWallet.toLowerCase(),
          asset,
          xessAmount,
          paidLamports: asset === "SOL" ? requiredLamports : null,
          paidUsdcAtomic: asset === "USDC" ? requiredUsdcAtomic : null,
          txSig,
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });

      if (phase === "private") {
        await tx.saleConfig.update({
          where: { id: cfg.id },
          data: { soldPrivateXess: cfg.soldPrivateXess + xessAmount },
        });
      } else {
        await tx.saleConfig.update({
          where: { id: cfg.id },
          data: { soldPublicXess: cfg.soldPublicXess + xessAmount },
        });
      }
    });

    return NextResponse.json({
      ok: true,
      xessAmount: xessAmount.toString(),
      asset,
      requiredLamports: requiredLamports.toString(),
      requiredUsdcAtomic: requiredUsdcAtomic.toString(),
    }, { headers: noCache });
  } catch (err) {
    console.error("Contribution error:", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500, headers: noCache });
  }
}
