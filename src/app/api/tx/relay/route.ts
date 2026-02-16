/**
 * Transaction Relay API
 *
 * POST /api/tx/relay
 * Accepts a client-signed transaction (base64) and relays it via
 * the server-side Gatekeeper RPC. Keeps Helius API key off the client.
 *
 * Only enabled when TX_RELAY_ENABLED=1 (presale/mainnet deployment).
 * Returns 404 on devnet so clients fall back to direct send.
 */

import { NextResponse } from "next/server";
import { rpc } from "@/lib/rpc";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (process.env.TX_RELAY_ENABLED !== "1") {
    return NextResponse.json(
      { ok: false, error: "RELAY_DISABLED" },
      { status: 404 }
    );
  }

  try {
    const { signedTxB64 } = await req.json();
    if (!signedTxB64 || typeof signedTxB64 !== "string") {
      return NextResponse.json(
        { ok: false, error: "MISSING_SIGNED_TX" },
        { status: 400 }
      );
    }

    const raw = Buffer.from(signedTxB64, "base64");

    const signature = await rpc((c) =>
      c.sendRawTransaction(raw, { skipPreflight: false })
    );

    await rpc((c) => c.confirmTransaction(signature, "confirmed"));

    return NextResponse.json({ ok: true, signature });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "RELAY_FAILED";
    console.error("[tx/relay] error:", e);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}
