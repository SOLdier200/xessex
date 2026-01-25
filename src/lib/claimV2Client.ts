/**
 * V2 Claim Client for XESS rewards
 *
 * Claims XESS to ANY connected wallet (no wallet linking required).
 * - Requires user to be logged into the site (prepare-claim is auth gated)
 * - Requires wallet-adapter connection for signing
 *
 * IMPORTANT: Run `anchor build` to regenerate the IDL with claim_v2 instruction.
 */

import { Connection, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";

// ---- CONFIG ----
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_XESS_CLAIM_PROGRAM_ID || "AKRLZssgxwQwC2gGgUtYtcU7JrhDyEfk1FHqQkZnFUax"
);

export const XESS_MINT = new PublicKey(process.env.NEXT_PUBLIC_XESS_MINT || "");

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

// Load IDL - regenerate with `anchor build` after adding claim_v2
import idl from "@/solana/idl/xess_claim.json";

// ---- Helpers ----
function hexToBytes32(hex: string): number[] {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]{64}$/.test(h)) throw new Error("Expected 32-byte hex");
  const buf = Buffer.from(h, "hex");
  return [...buf];
}

function proofHexToVec(proofHex: string[]): number[][] {
  return proofHex.map((hex) => {
    const h = hex.startsWith("0x") ? hex.slice(2) : hex;
    const buf = Buffer.from(h, "hex");
    if (buf.length !== 32) throw new Error("Bad proof element length");
    return [...buf];
  });
}

function u64leBuf(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

// PDA derivations
function findConfigPda() {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID)[0];
}

function findVaultAuthorityPda(configPda: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority"), configPda.toBuffer()],
    PROGRAM_ID
  )[0];
}

function findEpochRootPda(epoch: bigint) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("epoch_root"), u64leBuf(epoch)],
    PROGRAM_ID
  )[0];
}

function findReceiptV2Pda(epoch: bigint, userKeyBytes32: number[]) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("receipt_v2"), u64leBuf(epoch), Buffer.from(userKeyBytes32)],
    PROGRAM_ID
  )[0];
}

type PrepareClaimResponse = {
  ok: true;
  version: number;
  epoch: number;
  weekKey: string;
  rootHex: string;
  index: number;
  amountAtomic: string;
  userKeyHex: string;
  claimSaltHex: string;
  proofHex: string[];
};

type WalletLike = anchor.Wallet & {
  publicKey: PublicKey;
};

/**
 * Claims XESS to the currently connected wallet (ANY wallet).
 * - Requires user to be logged into your site (prepare-claim is auth gated)
 * - Requires wallet-adapter connection for signing
 */
export async function claimXessV2(opts: {
  epoch: number;
  wallet: WalletLike;
  connection?: Connection;
  commitment?: anchor.web3.Commitment;
}): Promise<{ signature: string }> {
  const { epoch, wallet } = opts;
  const commitment = opts.commitment ?? "confirmed";
  const connection = opts.connection ?? new Connection(RPC_URL, commitment);

  // 1) Fetch claim details (auth-gated)
  const res = await fetch(`/api/claims/prepare?epoch=${encodeURIComponent(epoch)}`, {
    method: "GET",
    headers: { accept: "application/json" },
    credentials: "include", // Include session cookies
  });

  const json = await res.json();
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Prepare claim failed (${res.status})`);
  }
  const data = json as PrepareClaimResponse;

  if ((data.version ?? 2) !== 2) {
    throw new Error(`Unexpected claim version=${data.version}. This helper is for v2.`);
  }

  const epochBn = new BN(String(data.epoch));
  const amountBn = new BN(data.amountAtomic);
  const index = data.index;

  const userKeyBytes32 = hexToBytes32(data.userKeyHex);
  const saltBytes32 = hexToBytes32(data.claimSaltHex);
  const proofVec = proofHexToVec(data.proofHex);

  // 2) Build Anchor provider + program
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment,
    preflightCommitment: commitment,
  });
  const program = new anchor.Program(idl as anchor.Idl, PROGRAM_ID, provider);

  // 3) Derive PDAs and token accounts
  const configPda = findConfigPda();
  const vaultAuthorityPda = findVaultAuthorityPda(configPda);
  const epochRootPda = findEpochRootPda(BigInt(data.epoch));
  const receiptV2Pda = findReceiptV2Pda(BigInt(data.epoch), userKeyBytes32);

  // vault ATA = ATA(owner=vault_authority PDA, mint=XESS_MINT)
  const vaultAta = getAssociatedTokenAddressSync(XESS_MINT, vaultAuthorityPda, true);

  // user ATA = ATA(owner=claimer wallet, mint=XESS_MINT)
  const userAta = getAssociatedTokenAddressSync(XESS_MINT, wallet.publicKey, false);

  // 4) Create user ATA if missing (so claim works 1-click)
  const ixs: TransactionInstruction[] = [];
  const userAtaInfo = await connection.getAccountInfo(userAta, commitment);
  if (!userAtaInfo) {
    ixs.push(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        userAta,          // ata
        wallet.publicKey, // owner
        XESS_MINT
      )
    );
  }

  // 5) Send claim_v2
  // NOTE: Anchor exposes claim_v2 as claimV2 (camelCase)
  const sig = await program.methods
    .claimV2(epochBn, amountBn, index, userKeyBytes32, saltBytes32, proofVec)
    .accounts({
      config: configPda,
      vaultAuthority: vaultAuthorityPda,
      epochRoot: epochRootPda,
      receiptV2: receiptV2Pda,
      claimer: wallet.publicKey,
      vaultAta,
      userAta,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions(ixs)
    .rpc({ commitment });

  return { signature: sig };
}

/**
 * Check if a user has already claimed for a specific epoch.
 * Returns the receipt PDA address and whether it exists.
 */
export async function checkClaimStatus(opts: {
  epoch: number;
  userKeyHex: string;
  connection?: Connection;
}): Promise<{ receiptPda: string; claimed: boolean }> {
  const { epoch, userKeyHex } = opts;
  const connection = opts.connection ?? new Connection(RPC_URL, "confirmed");

  const userKeyBytes32 = hexToBytes32(userKeyHex);
  const receiptV2Pda = findReceiptV2Pda(BigInt(epoch), userKeyBytes32);

  const acctInfo = await connection.getAccountInfo(receiptV2Pda, "confirmed");
  const claimed = acctInfo !== null && acctInfo.owner.equals(PROGRAM_ID);

  return {
    receiptPda: receiptV2Pda.toBase58(),
    claimed,
  };
}
