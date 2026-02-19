import { Transaction, Connection } from "@solana/web3.js";

function isConfirmTimeoutish(e: unknown): boolean {
  const msg = String((e as Error)?.message || e);
  return (
    msg.includes("TransactionExpiredTimeoutError") ||
    msg.includes("was not confirmed") ||
    msg.toLowerCase().includes("timeout")
  );
}

/**
 * Send a signed transaction via the server relay (Gatekeeper),
 * falling back to direct send if relay is disabled (404).
 *
 * IMPORTANT:
 * - Returns signature once sent.
 * - Confirmation is best-effort (never throws once signature exists).
 * - Caller must use /api/rewards/claim/confirm (receipt PDA check)
 *   as the authoritative "did it claim?" verification.
 */
export async function sendSignedTx(
  signed: Transaction,
  connection: Connection
): Promise<string> {
  const serialized = signed.serialize();
  const signedTxB64 = Buffer.from(serialized).toString("base64");

  // 1) Try relay first
  try {
    const relayRes = await fetch("/api/tx/relay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signedTxB64 }),
    });

    // Relay disabled -> fall through to direct
    if (relayRes.status !== 404) {
      const j = await relayRes.json().catch(() => null);

      // If relay managed to send, it returns ok:true + signature
      // (confirmed may be true or false — doesn't matter here)
      if (relayRes.ok && j?.ok && j?.signature) {
        return j.signature as string;
      }

      // If relay returned a 5xx but included a signature, still return it
      if (j?.signature) {
        return j.signature as string;
      }
    }
  } catch {
    // Network error contacting relay, fall through to direct send
  }

  // 2) Fallback: direct send (devnet / relay unavailable)
  const sig = await connection.sendRawTransaction(serialized, {
    skipPreflight: false,
    maxRetries: 3,
  });

  // Best-effort confirm — do NOT throw once we have a signature.
  // The caller reconciles via /claim/confirm which checks receipt PDA.
  try {
    await connection.confirmTransaction(sig, "confirmed");
  } catch {
    // Swallow all confirm errors. Signature exists and tx may land later.
  }

  return sig;
}
