"use client";

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
} from "@solana/spl-token";
import { XESS_ATOMIC, RAFFLE_XESS_TICKET_ATOMIC } from "@/lib/rewardsConstants";

export function getRpcUrlClient() {
  return (
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.devnet.solana.com"
  );
}

/**
 * Build a transaction to buy XESS raffle tickets by transferring XESS to treasury ATA.
 */
export function buildXessRaffleTicketTx(params: {
  buyer: PublicKey;
  tickets: bigint;
}): { tx: Transaction; amountAtomic: bigint } {
  const { buyer, tickets } = params;

  if (tickets <= 0n) throw new Error("tickets_must_be_positive");

  const xessMintStr = process.env.NEXT_PUBLIC_XESS_MINT;
  if (!xessMintStr) throw new Error("NEXT_PUBLIC_XESS_MINT missing");

  const treasuryAtaStr = process.env.NEXT_PUBLIC_XESS_TREASURY_ATA;
  if (!treasuryAtaStr) throw new Error("NEXT_PUBLIC_XESS_TREASURY_ATA missing");

  const xessMint = new PublicKey(xessMintStr);
  const treasuryAta = new PublicKey(treasuryAtaStr);

  const buyerAta = getAssociatedTokenAddressSync(xessMint, buyer);

  const amountAtomic = tickets * RAFFLE_XESS_TICKET_ATOMIC; // 100 XESS * tickets (atomic)

  // sanity check: decimals=9 (XESS_ATOMIC = 1e9)
  if (RAFFLE_XESS_TICKET_ATOMIC !== 100n * XESS_ATOMIC) {
    throw new Error("ticket_atomic_mismatch");
  }

  const ix = createTransferInstruction(
    buyerAta,      // source
    treasuryAta,   // destination
    buyer,         // owner
    amountAtomic
  );

  const tx = new Transaction().add(ix);
  return { tx, amountAtomic };
}

export function getConnectionClient() {
  return new Connection(getRpcUrlClient(), "confirmed");
}
