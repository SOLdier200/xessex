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

    // Fetch SOL and XESS balances in parallel — each independently safe
    function safe<T>(p: Promise<T>): Promise<T | null> {
      return p.then((v) => v).catch(() => null);
    }

    const [solLamports, xessAtomic] = await Promise.all([
      safe(connection.getBalance(walletPubkey)),
      safe(getXessAtomicBalance(wallet)),
    ]);

    // If either is null, return partial data with 503
    if (solLamports === null || xessAtomic === null) {
      return NextResponse.json({
        ok: false,
        wallet,
        error: "RPC_UNAVAILABLE",
        balances: {
          sol: solLamports === null ? null : {
            lamports: solLamports,
            formatted: (solLamports / LAMPORTS_PER_SOL).toFixed(4),
          },
          xess: xessAtomic === null ? null : {
            atomic: xessAtomic.toString(),
            formatted: formatXess(xessAtomic, 2),
          },
        },
      }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      wallet,
      balances: {
        sol: {
          lamports: solLamports,
          formatted: (solLamports / LAMPORTS_PER_SOL).toFixed(4),
        },
        xess: {
          atomic: xessAtomic.toString(),
          formatted: formatXess(xessAtomic, 2),
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
