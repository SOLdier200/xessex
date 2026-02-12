/**
 * GET /api/wallet/balances?wallet=<address>
 *
 * Returns SOL and XESS balances for a wallet address
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getXessAtomicBalance, formatXess } from "@/lib/xessBalance";

export const runtime = "nodejs";

function getRpcUrl(): string {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com"
  );
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { ok: false, error: "MISSING_WALLET" },
      { status: 400 }
    );
  }

  // Validate wallet address
  try {
    new PublicKey(wallet);
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_WALLET" },
      { status: 400 }
    );
  }

  try {
    const connection = new Connection(getRpcUrl(), "confirmed");
    const walletPubkey = new PublicKey(wallet);

    // Fetch SOL and XESS balances in parallel
    const [solLamports, xessAtomic] = await Promise.all([
      connection.getBalance(walletPubkey),
      getXessAtomicBalance(wallet),
    ]);

    // Convert to human-readable
    const solBalance = solLamports / LAMPORTS_PER_SOL;

    if (xessAtomic === null) {
      return NextResponse.json({
        ok: false,
        error: "rpc_unavailable",
        wallet,
        balances: {
          sol: {
            lamports: solLamports,
            formatted: solBalance.toFixed(4),
          },
          xess: null,
        },
      }, { status: 503 });
    }

    const xessBalance = formatXess(xessAtomic, 2);

    return NextResponse.json({
      ok: true,
      wallet,
      balances: {
        sol: {
          lamports: solLamports,
          formatted: solBalance.toFixed(4),
        },
        xess: {
          atomic: xessAtomic.toString(),
          formatted: xessBalance,
        },
      },
    });
  } catch (error) {
    console.error("[wallet/balances] Error fetching balances:", error);
    return NextResponse.json(
      { ok: false, error: "FETCH_ERROR" },
      { status: 500 }
    );
  }
}
