import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const prisma = new PrismaClient();

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const TREASURY = process.env.SUB_TREASURY_WALLET || "";
const PRICE_SOL = parseFloat(process.env.SUB_PRICE_SOL || "0.05");

export async function POST(req: Request) {
  try {
    const { signature } = await req.json();

    if (!signature) {
      return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 400 });
    }

    // Get current user from session
    const cookieStore = await cookies();
    const token = cookieStore.get("xessex_session")?.value;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 });
    }

    const user = session.user;

    // Check if signature was already used (replay protection)
    const existing = await prisma.subscription.findFirst({
      where: { lastTxSig: signature },
    });

    if (existing) {
      return NextResponse.json({ ok: false, error: "Transaction already used" }, { status: 400 });
    }

    // Verify transaction on-chain
    const connection = new Connection(RPC_URL, "confirmed");
    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return NextResponse.json({ ok: false, error: "Transaction not found" }, { status: 400 });
    }

    if (tx.meta?.err) {
      return NextResponse.json({ ok: false, error: "Transaction failed" }, { status: 400 });
    }

    // Verify payment to treasury
    const treasuryPubkey = new PublicKey(TREASURY);
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    const accountKeys = tx.transaction.message.getAccountKeys().staticAccountKeys;

    let treasuryIdx = -1;
    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys[i].equals(treasuryPubkey)) {
        treasuryIdx = i;
        break;
      }
    }

    if (treasuryIdx === -1) {
      return NextResponse.json({ ok: false, error: "Treasury not in transaction" }, { status: 400 });
    }

    const received = (postBalances[treasuryIdx] - preBalances[treasuryIdx]) / LAMPORTS_PER_SOL;
    const minAmount = PRICE_SOL * 0.99; // Allow 1% slippage

    if (received < minAmount) {
      return NextResponse.json(
        { ok: false, error: `Insufficient payment: ${received.toFixed(4)} SOL` },
        { status: 400 }
      );
    }

    // Create or update subscription
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {
        status: "ACTIVE",
        tier: "MEMBER",
        expiresAt,
        lastTxSig: signature,
      },
      create: {
        userId: user.id,
        status: "ACTIVE",
        tier: "MEMBER",
        expiresAt,
        lastTxSig: signature,
      },
    });

    return NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    console.error("Subscription confirm error:", err);
    return NextResponse.json({ ok: false, error: "Confirmation failed" }, { status: 500 });
  }
}
