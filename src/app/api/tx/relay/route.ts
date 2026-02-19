/**
 * Transaction Relay API
 *
 * POST /api/tx/relay
 * Accepts a client-signed transaction (base64) and relays it via
 * the server-side Gatekeeper RPC. Keeps Helius API key off the client.
 *
 * Only enabled when TX_RELAY_ENABLED=1 (presale/mainnet deployment).
 * Returns 404 on devnet so clients fall back to direct send.
 *
 * IMPORTANT: Once sendRawTransaction succeeds, we ALWAYS return the
 * signature (ok:true). Confirm is best-effort — the real source of
 * truth is the receipt PDA checked by /claim/confirm.
 *
 * Gatekeeper (send != read URL) does NOT support preflight/simulate,
 * so skipPreflight must be true when using it.
 */

import { NextResponse } from "next/server";
import { connSend, connRead, rpcUrls } from "@/lib/rpc";

export const runtime = "nodejs";

function isConfirmTimeoutish(e: unknown): boolean {
  const msg = String((e as Error)?.message || e);
  return (
    msg.includes("TransactionExpiredTimeoutError") ||
    msg.includes("was not confirmed") ||
    msg.toLowerCase().includes("timeout")
  );
}

export async function POST(req: Request) {
  if (process.env.TX_RELAY_ENABLED !== "1") {
    return NextResponse.json(
      { ok: false, error: "RELAY_DISABLED" },
      { status: 404 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const signedTxB64: unknown = body?.signedTxB64;

  if (!signedTxB64 || typeof signedTxB64 !== "string") {
    return NextResponse.json(
      { ok: false, error: "MISSING_SIGNED_TX" },
      { status: 400 }
    );
  }

  const raw = Buffer.from(signedTxB64 as string, "base64");

  const { send, read } = rpcUrls();
  const usingGatekeeper = send !== read;

  // Gatekeeper is send-only and cannot preflight/simulate
  const skipPreflight = usingGatekeeper;

  // 1) SEND — hard fail only if send itself fails
  let signature: string;
  try {
    signature = await connSend().sendRawTransaction(raw, {
      skipPreflight,
      maxRetries: usingGatekeeper ? 0 : 3,
    });
  } catch (e: unknown) {
    console.error("[tx/relay] send error:", e);
    const msg =
      (e as any)?.transactionMessage ||
      (e instanceof Error ? e.message : "RELAY_SEND_FAILED");
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  // 2) BEST-EFFORT CONFIRM — never hard fail after send succeeded
  try {
    await connRead().confirmTransaction(signature, "confirmed");
    return NextResponse.json({ ok: true, signature, confirmed: true });
  } catch (e: unknown) {
    console.warn("[tx/relay] confirm warning:", e);

    if (isConfirmTimeoutish(e)) {
      return NextResponse.json({
        ok: true,
        signature,
        confirmed: false,
        note: "CONFIRM_TIMEOUT_UNKNOWN",
      });
    }

    return NextResponse.json({
      ok: true,
      signature,
      confirmed: false,
      note: "CONFIRM_ERROR_UNKNOWN",
    });
  }
}
