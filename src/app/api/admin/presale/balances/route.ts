/**
 * Admin Presale Treasury Balances API
 *
 * GET /api/admin/presale/balances
 * Returns on-chain SOL and USDC balances of the presale treasury wallet.
 */

import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAccessContext } from "@/lib/access";
import { rpc } from "@/lib/rpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noCache = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
};

export async function GET() {
  const ctx = await getAccessContext();

  if (!ctx.isAdminOrMod) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403, headers: noCache }
    );
  }

  const treasuryWallet = process.env.PRESALE_TREASURY_WALLET;
  const usdcAta = process.env.PRESALE_USDC_ATA;

  if (!treasuryWallet || !usdcAta) {
    return NextResponse.json(
      { ok: false, error: "treasury_not_configured" },
      { status: 500, headers: noCache }
    );
  }

  try {
    const [solBalance, usdcBalance] = await Promise.all([
      rpc((c) => c.getBalance(new PublicKey(treasuryWallet))),
      rpc((c) =>
        c.getTokenAccountBalance(new PublicKey(usdcAta))
          .then((r) => r.value.amount)
      ).catch(() => "0"),
    ]);

    return NextResponse.json(
      {
        ok: true,
        treasuryWallet,
        usdcAta,
        solLamports: solBalance.toString(),
        usdcAtomic: usdcBalance.toString(),
      },
      { headers: noCache }
    );
  } catch (err) {
    console.error("Admin presale balances error:", err);
    return NextResponse.json(
      { ok: false, error: "rpc_error" },
      { status: 502, headers: noCache }
    );
  }
}
