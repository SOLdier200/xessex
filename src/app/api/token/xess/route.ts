import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

export const runtime = "nodejs";

function heliusRpcUrl() {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error("HELIUS_API_KEY missing");
  return `https://mainnet.helius-rpc.com/?api-key=${key}`;
}

export async function GET() {
  try {
    const mintStr = process.env.NEXT_PUBLIC_XESS_MINT;
    if (!mintStr) {
      return NextResponse.json({ ok: false, error: "mint_not_configured" }, { status: 500 });
    }

    const connection = new Connection(heliusRpcUrl(), "confirmed");
    const mint = new PublicKey(mintStr);

    const info = await connection.getParsedAccountInfo(mint);
    const value = info.value as { data?: { parsed?: { info?: Record<string, unknown> } } } | null;

    if (!value?.data?.parsed?.info) {
      return NextResponse.json({ ok: false, error: "mint_not_found" }, { status: 404 });
    }

    const parsed = value.data.parsed.info as {
      decimals: number;
      supply: string;
      mintAuthority: string | null;
      freezeAuthority: string | null;
    };

    const decimals = Number(parsed.decimals);
    const supplyRawStr = String(parsed.supply);
    const supplyRaw = BigInt(supplyRawStr);

    const denom = 10n ** BigInt(decimals);
    const supplyUi = (supplyRaw / denom).toString();
    const supplyUiExact =
      (supplyRaw / denom).toString() + "." + (supplyRaw % denom).toString().padStart(decimals, "0");

    const mintAuthority = parsed.mintAuthority ?? null;
    const freezeAuthority = parsed.freezeAuthority ?? null;

    const expectedMint = mintStr;
    const expectedSupplyUi = process.env.NEXT_PUBLIC_XESS_SUPPLY_UI ?? "1000000000";

    const verified =
      expectedMint === mintStr &&
      supplyUi === expectedSupplyUi &&
      mintAuthority === null &&
      freezeAuthority === null;

    return NextResponse.json({
      ok: true,
      network: "solana-mainnet",
      rpc: "helius",
      mint: mintStr,
      decimals,
      supplyRaw: supplyRawStr,
      supplyUi,
      supplyUiExact,
      mintAuthority,
      freezeAuthority,
      verified,
      checks: {
        mintMatches: expectedMint === mintStr,
        supplyMatches: supplyUi === expectedSupplyUi,
        mintAuthorityDisabled: mintAuthority === null,
        freezeAuthorityDisabled: freezeAuthority === null,
      },
      expected: {
        mint: expectedMint,
        supplyUi: expectedSupplyUi,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: message },
      { status: 500 }
    );
  }
}
