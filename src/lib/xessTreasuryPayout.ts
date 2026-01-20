/**
 * XESS Treasury Payout
 *
 * Server-side utility to send XESS from treasury to a winner's wallet.
 * Requires XESS_TREASURY_KEYPAIR environment variable (JSON array of secret key bytes).
 */

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

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

function loadTreasuryKeypair(): Keypair {
  const raw = reqEnv("XESS_TREASURY_KEYPAIR");
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr)) throw new Error("XESS_TREASURY_KEYPAIR must be JSON array");
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

/**
 * Send XESS from treasury to a wallet
 *
 * @param toWallet - Destination wallet address (base58)
 * @param amountAtomic - Amount in atomic units (9 decimals)
 * @returns Transaction signature
 */
export async function payoutXessToWallet(params: {
  toWallet: string;
  amountAtomic: bigint;
}): Promise<string> {
  const { toWallet, amountAtomic } = params;

  const connection = new Connection(getRpcUrl(), "confirmed");
  const treasuryKp = loadTreasuryKeypair();

  const xessMint = new PublicKey(reqEnv("XESS_MINT"));
  const treasuryAta = new PublicKey(reqEnv("XESS_TREASURY_ATA"));

  const toPk = new PublicKey(toWallet);
  const toAta = getAssociatedTokenAddressSync(xessMint, toPk);

  const ix: (
    | ReturnType<typeof createAssociatedTokenAccountInstruction>
    | ReturnType<typeof createTransferInstruction>
  )[] = [];

  const toAtaInfo = await connection.getAccountInfo(toAta);
  if (!toAtaInfo) {
    ix.push(
      createAssociatedTokenAccountInstruction(
        treasuryKp.publicKey, // payer
        toAta, // ata
        toPk, // owner
        xessMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  ix.push(
    createTransferInstruction(treasuryAta, toAta, treasuryKp.publicKey, amountAtomic)
  );

  const tx = new Transaction().add(...ix);
  tx.feePayer = treasuryKp.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;

  tx.sign(treasuryKp);

  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}
