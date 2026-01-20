/**
 * Verify XESS ticket purchase transaction on-chain
 *
 * Validates:
 * - Correct mint (XESS_MINT)
 * - Correct source (user ATA)
 * - Correct destination (XESS_TREASURY_ATA)
 * - Correct amount (must be exact multiple of ticket price: 100 XESS)
 * - Transaction confirmed
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { RAFFLE_XESS_TICKET_ATOMIC } from "@/lib/rewardsConstants";

function getRpcUrl() {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.devnet.solana.com"
  );
}

function reqEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env var missing`);
  return v;
}

export async function verifyXessTicketPurchaseTx(params: {
  txSig: string;
  userWallet: string;
}): Promise<{
  amountAtomic: bigint;
  quantity: bigint;
  userAta: string;
  treasuryAta: string;
}> {
  const { txSig, userWallet } = params;

  const connection = new Connection(getRpcUrl(), "confirmed");
  const xessMint = new PublicKey(reqEnv("XESS_MINT"));
  const treasuryAta = new PublicKey(reqEnv("XESS_TREASURY_ATA"));
  const userPk = new PublicKey(userWallet);

  const userAta = getAssociatedTokenAddressSync(xessMint, userPk);

  const tx = await connection.getParsedTransaction(txSig, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });

  if (!tx) throw new Error("tx_not_found");
  if (!tx.meta) throw new Error("tx_missing_meta");
  if (tx.meta.err) throw new Error("tx_failed");

  // Search parsed instructions (top-level + inner) for SPL token transfers
  type ParsedIx = {
    program?: string;
    parsed?: {
      type?: string;
      info?: {
        mint?: string;
        source?: string;
        destination?: string;
        amount?: string;
        tokenAmount?: { amount?: string };
      };
    };
  };

  const allIxs: ParsedIx[] = [];

  for (const ix of tx.transaction.message.instructions as ParsedIx[]) allIxs.push(ix);
  for (const inner of tx.meta.innerInstructions ?? []) {
    for (const ix of inner.instructions as ParsedIx[]) allIxs.push(ix);
  }

  let totalPaid = 0n;

  for (const ix of allIxs) {
    const prog = ix.program;
    const parsed = ix.parsed;

    if (prog !== "spl-token" || !parsed) continue;

    // transfer / transferChecked both appear
    const type = parsed.type;
    if (type !== "transfer" && type !== "transferChecked") continue;

    const info = parsed.info || {};

    // transferChecked includes mint, transfer sometimes doesn't
    const mintStr = info.mint;
    if (mintStr && mintStr !== xessMint.toBase58()) continue;

    const src = info.source;
    const dst = info.destination;

    if (src !== userAta.toBase58()) continue;
    if (dst !== treasuryAta.toBase58()) continue;

    // Amount can be string atomic or uiAmount. We want atomic.
    // transferChecked usually has tokenAmount.amount
    let amt: bigint | null = null;

    if (info.amount) {
      // transfer
      amt = BigInt(info.amount);
    } else if (info.tokenAmount?.amount) {
      // transferChecked
      amt = BigInt(info.tokenAmount.amount);
    }

    if (amt && amt > 0n) totalPaid += amt;
  }

  if (totalPaid <= 0n) throw new Error("no_valid_xess_transfer_found");

  // Must be an exact multiple of ticket price (100 XESS)
  const price = RAFFLE_XESS_TICKET_ATOMIC;
  const qty = totalPaid / price;
  const remainder = totalPaid % price;

  if (qty <= 0n) throw new Error("payment_too_small");
  if (remainder !== 0n) throw new Error("payment_not_multiple_of_ticket_price");

  return {
    amountAtomic: totalPaid,
    quantity: qty,
    userAta: userAta.toBase58(),
    treasuryAta: treasuryAta.toBase58(),
  };
}
