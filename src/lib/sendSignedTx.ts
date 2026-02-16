/**
 * Client-side signed transaction sender.
 *
 * Tries the server relay (/api/tx/relay) first — this uses Gatekeeper
 * on the presale/mainnet deployment and keeps the Helius key private.
 *
 * If relay returns 404 (disabled on devnet), falls back to direct
 * sendRawTransaction + confirmTransaction via the provided connection.
 */

import { Connection, Transaction } from "@solana/web3.js";

export async function sendSignedTx(
  signed: Transaction,
  connection: Connection
): Promise<string> {
  const serialized = signed.serialize();
  const signedTxB64 = Buffer.from(serialized).toString("base64");

  // Try relay first (mainnet presale has it; devnet returns 404)
  try {
    const relayRes = await fetch("/api/tx/relay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signedTxB64 }),
    });

    if (relayRes.ok) {
      const j = await relayRes.json();
      if (j?.ok && j.signature) return j.signature as string;
    }
    // 404 = relay disabled, fall through to direct send
  } catch {
    // Network error contacting relay, fall through
  }

  // Fallback: direct send (devnet / relay unavailable)
  const sig = await connection.sendRawTransaction(serialized, {
    skipPreflight: false,
  });
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}
