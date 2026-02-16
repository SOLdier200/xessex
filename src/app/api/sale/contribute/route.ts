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
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction as createSplTransfer,
} from "@solana/spl-token";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { getSolPriceUsd, computeLamportsPerXess } from "@/lib/solPrice";
import crypto from "crypto";

export const runtime = "nodejs";

// Environment configuration
import { rpc, connPrimary } from "@/lib/rpc";

const TREASURY_WALLET = process.env.PRESALE_TREASURY_WALLET!;
const USDC_ATA = process.env.PRESALE_USDC_ATA!;
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

// XESS token has 9 decimals
const XESS_DECIMALS = 9n;
const XESS_ATOMIC_MULT = 10n ** XESS_DECIMALS; // 1_000_000_000n

function loadKeypair(raw: string): Keypair {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    const arr = JSON.parse(trimmed) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }
  throw new Error("XESS_TREASURY_KEYPAIR must be a JSON array");
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
  console.log("[contribute] HIT", new Date().toISOString());
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

    const preflight = !!body?.preflight;

    let xessAmount: bigint;
    try {
      xessAmount = BigInt(body?.xessAmount ?? 0);
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_xess_amount" }, { status: 400, headers: noCache });
    }

    if (!preflight && !txSig) {
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

    // Preflight mode: all validation passed, return early before on-chain work
    if (preflight) {
      return NextResponse.json({ ok: true, preflight: true }, { headers: noCache });
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

    const requiredUsdcAtomic = priceUsdMicros * xessAmount;

    // On-chain verification
    const connection = connPrimary();

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

    // Record contribution and update sold counters atomically with row lock
    const contribution = await db.$transaction(async (tx) => {
      // Lock the SaleConfig row to prevent concurrent overselling
      await tx.$executeRaw`SELECT id FROM "SaleConfig" WHERE id = ${cfg.id} FOR UPDATE`;

      // Re-read config with lock held
      const lockedCfg = await tx.saleConfig.findUniqueOrThrow({ where: { id: cfg.id } });

      // Re-check phase allocation remaining under lock
      const lockedRemaining = phase === "private"
        ? lockedCfg.privateAllocation - lockedCfg.soldPrivateXess
        : lockedCfg.publicAllocation - lockedCfg.soldPublicXess;

      if (xessAmount > lockedRemaining) {
        throw new Error("SOLD_OUT");
      }

      // Re-check wallet cap under lock
      const lockedExisting = await tx.saleContribution.aggregate({
        where: {
          wallet: sessionWallet.toLowerCase(),
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        _sum: { xessAmount: true },
      });

      const lockedAlready = lockedExisting._sum.xessAmount ?? 0n;
      if (lockedAlready + xessAmount > lockedCfg.walletCapXess) {
        throw new Error("CAP_EXCEEDED");
      }

      const contrib = await tx.saleContribution.create({
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
          where: { id: lockedCfg.id },
          data: { soldPrivateXess: { increment: xessAmount } },
        });
      } else {
        await tx.saleConfig.update({
          where: { id: lockedCfg.id },
          data: { soldPublicXess: { increment: xessAmount } },
        });
      }

      return contrib;
    });

    // ─── Deliver XESS tokens to buyer ─────────────────────────
    let deliverySig: string | null = null;
    try {
      const xessMintStr = process.env.XESS_MINT;
      const treasuryKeyStr = process.env.XESS_TREASURY_KEYPAIR;

      if (!xessMintStr || !treasuryKeyStr) {
        throw new Error("Missing XESS_MINT or XESS_TREASURY_KEYPAIR env vars");
      }

      const xessMint = new PublicKey(xessMintStr);
      const treasuryKeypair = loadKeypair(treasuryKeyStr);
      const buyer = new PublicKey(sessionWallet);

      // Use explicit ATA env var if set (bypasses any derivation mismatch),
      // otherwise compute from keypair public key + mint.
      const ataOverride = process.env.XESS_TREASURY_ATA;
      const treasuryAta = ataOverride
        ? new PublicKey(ataOverride)
        : await getAssociatedTokenAddress(xessMint, treasuryKeypair.publicKey);
      const buyerAta = await getAssociatedTokenAddress(xessMint, buyer);

      // Convert whole XESS → atomic units (9 decimals)
      const xessAtomic = xessAmount * XESS_ATOMIC_MULT;

      console.log("[contribute] DELIVERY DEBUG", {
        mint: xessMintStr,
        treasuryPubkey: treasuryKeypair.publicKey.toBase58(),
        treasuryAta: treasuryAta.toBase58(),
        ataSource: ataOverride ? "env_override" : "derived",
        buyer: buyer.toBase58(),
        buyerAta: buyerAta.toBase58(),
        xessAtomic: xessAtomic.toString(),
        rpc: "gatekeeper",
      });

      const ixs: Parameters<Transaction["add"]> = [];

      // Buyer should have created their XESS ATA in the payment tx.
      // Fallback: treasury creates it if somehow missing.
      const buyerAtaInfo = await connection.getAccountInfo(buyerAta);
      if (!buyerAtaInfo) {
        console.warn(`Buyer ATA missing for ${sessionWallet} — treasury creating as fallback`);
        ixs.push(
          createAssociatedTokenAccountInstruction(
            treasuryKeypair.publicKey,
            buyerAta,
            buyer,
            xessMint,
          )
        );
      }

      // Transfer XESS from treasury ATA → buyer ATA
      ixs.push(
        createSplTransfer(
          treasuryAta,
          buyerAta,
          treasuryKeypair.publicKey,
          xessAtomic,
        )
      );

      const deliveryTx = new Transaction().add(...ixs);
      deliveryTx.feePayer = treasuryKeypair.publicKey;

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      deliveryTx.recentBlockhash = blockhash;
      deliveryTx.lastValidBlockHeight = lastValidBlockHeight;

      deliverySig = await sendAndConfirmTransaction(
        connection,
        deliveryTx,
        [treasuryKeypair],
        {
          commitment: "confirmed",
          skipPreflight: true,
          maxRetries: 3,
        },
      );

      // Store delivery sig in DB
      await db.saleContribution.update({
        where: { id: contribution.id },
        data: { deliveryTxSig: deliverySig },
      });
    } catch (deliveryErr) {
      console.error("XESS delivery failed (payment was recorded):", deliveryErr);
      // Payment is verified and recorded — admin can retry delivery later
      return NextResponse.json({
        ok: true,
        xessAmount: xessAmount.toString(),
        asset,
        paymentSig: txSig,
        xessSig: null,
        deliveryPending: true,
      }, { headers: noCache });
    }

    return NextResponse.json({
      ok: true,
      xessAmount: xessAmount.toString(),
      asset,
      paymentSig: txSig,
      xessSig: deliverySig,
    }, { headers: noCache });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "SOLD_OUT") {
        return NextResponse.json({ ok: false, error: "sold_out" }, { status: 409, headers: noCache });
      }
      if (err.message === "CAP_EXCEEDED") {
        return NextResponse.json({ ok: false, error: "cap_exceeded" }, { status: 400, headers: noCache });
      }
    }
    console.error("Contribution error:", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500, headers: noCache });
  }
}
