import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export type ClaimPreparePayload = {
  epoch: string;
  amountAtomic: string;
  index: number;
  proof: number[][] | string[]; // later: [u8;32][]
  programId: string;
  pdas: { config: string; vaultAuthority: string; epochRoot: string; receipt: string };
  vaultAta: string;
  claimer: string;
  xessMint: string;
};

export async function buildClaimTx(args: {
  connection: Connection;
  walletPubkey: PublicKey;
  idl: anchor.Idl;
  prepare: ClaimPreparePayload;
  tokenProgram?: PublicKey;
}): Promise<{ tx: Transaction; userAta: PublicKey }> {
  const { connection, walletPubkey, idl, prepare } = args;

  const programId = new PublicKey(prepare.programId);
  const xessMint = new PublicKey(prepare.xessMint);

  const provider = {
    connection,
    publicKey: walletPubkey,
  } as anchor.Provider;
  const program = new anchor.Program({ ...idl, address: programId.toBase58() } as anchor.Idl, provider);

  // Derive user ATA
  const userAta = getAssociatedTokenAddressSync(xessMint, walletPubkey);

  // Check if user ATA exists
  const userAtaInfo = await connection.getAccountInfo(userAta);

  // Convert proof into the on-chain type Vec<[u8;32]>
  // You will standardize this once your merkle system is in.
  // For now, assume proof is [] and you're testing plumbing.
  const proofVec: number[][] = Array.isArray(prepare.proof) ? (prepare.proof as any) : [];

  const ix = await program.methods
    .claim(
      new anchor.BN(prepare.epoch),
      new anchor.BN(prepare.amountAtomic),
      prepare.index,
      proofVec as any
    )
    .accounts({
      config: new PublicKey(prepare.pdas.config),
      vaultAuthority: new PublicKey(prepare.pdas.vaultAuthority),
      epochRoot: new PublicKey(prepare.pdas.epochRoot),
      receipt: new PublicKey(prepare.pdas.receipt),
      claimer: walletPubkey,
      vaultAta: new PublicKey(prepare.vaultAta),
      userAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .instruction();

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: walletPubkey,
    blockhash,
    lastValidBlockHeight,
  });

  // If user ATA doesn't exist, create it first
  if (!userAtaInfo) {
    const createAtaIx = createAssociatedTokenAccountInstruction(
      walletPubkey,        // payer
      userAta,             // ata address
      walletPubkey,        // owner
      xessMint,            // mint
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    tx.add(createAtaIx);
  }

  tx.add(ix);

  return { tx, userAta };
}
