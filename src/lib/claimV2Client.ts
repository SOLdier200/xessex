/**
 * V2 Claim Client for XESS rewards
 *
 * Claims XESS to ANY connected wallet (no wallet linking required).
 * - Requires user to be logged into the site (prepare-claim is auth gated)
 * - Requires wallet-adapter connection for signing
 *
 * IMPORTANT: Run `anchor build` to regenerate the IDL with claim_v2 instruction.
 */

import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
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

/**
 * Detect Phantom Android in-app browser.
 * Phantom mobile confirm UI breaks on large txs - we split into 2 smaller txs.
 */
function isPhantomAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("android") && ua.includes("phantom");
}

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

function findReceiptV2Pda(epoch: bigint, claimerPubkey: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("receipt_v2"), u64leBuf(epoch), claimerPubkey.toBuffer()],
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
 * Claims XESS to the currently connected wallet.
 * V2 wallet-based: the claimer pubkey IS the identity (no userKey arg needed).
 * - Requires user to be logged into your site (prepare-claim is auth gated)
 * - Requires wallet-adapter connection for signing
 * - The claim MUST be made with the wallet that earned the rewards
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

  // Verify wallet matches the leaf's userKeyHex (wallet pubkey)
  const connectedWalletHex = wallet.publicKey.toBuffer().toString("hex");
  if (data.userKeyHex !== connectedWalletHex) {
    throw new Error(
      `Wallet mismatch: connected wallet ${connectedWalletHex.slice(0, 16)}... ` +
      `does not match claim wallet ${data.userKeyHex.slice(0, 16)}...`
    );
  }

  const epochBn = new BN(String(data.epoch));
  const amountBn = new BN(data.amountAtomic);
  const index = data.index;

  // V2 wallet-based: userKey is derived on-chain from claimer, not passed as arg
  const saltBytes32 = hexToBytes32(data.claimSaltHex);

  // Ensure proofHex is a string array (it comes from JSON, might need parsing)
  const proofHexArray = Array.isArray(data.proofHex)
    ? data.proofHex
    : (typeof data.proofHex === 'string' ? JSON.parse(data.proofHex) : data.proofHex);
  const proofVec = proofHexToVec(proofHexArray);

  // Sanity checks before calling claimV2
  if (!Array.isArray(saltBytes32) || saltBytes32.length !== 32) {
    throw new Error(`saltBytes32 must be number[32], got ${typeof saltBytes32} len=${saltBytes32?.length}`);
  }
  if (!Array.isArray(proofVec) || (proofVec.length > 0 && (!Array.isArray(proofVec[0]) || proofVec[0].length !== 32))) {
    throw new Error(`proofVec must be number[][32], got proofVec[0] len=${proofVec?.[0]?.length}`);
  }

  console.log("[claimV2] Args check:", {
    epoch: data.epoch,
    amount: data.amountAtomic,
    index: data.index,
    saltLen: saltBytes32.length,
    proofCount: proofVec.length,
    proofElementLen: proofVec[0]?.length,
  });

  // 2) Build Anchor provider + program
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment,
    preflightCommitment: commitment,
  });
  // Anchor v0.30+ API: Program(idl, provider) - program ID is in the IDL
  const program = new anchor.Program(idl as anchor.Idl, provider);

  // 3) Derive PDAs and token accounts
  const configPda = findConfigPda();
  const vaultAuthorityPda = findVaultAuthorityPda(configPda);
  const epochRootPda = findEpochRootPda(BigInt(data.epoch));
  // V2: receipt PDA uses claimer pubkey (not userKeyBytes32)
  const receiptV2Pda = findReceiptV2Pda(BigInt(data.epoch), wallet.publicKey);

  // vault ATA = ATA(owner=vault_authority PDA, mint=XESS_MINT)
  const vaultAta = getAssociatedTokenAddressSync(XESS_MINT, vaultAuthorityPda, true);

  // user ATA = ATA(owner=claimer wallet, mint=XESS_MINT)
  const userAta = getAssociatedTokenAddressSync(XESS_MINT, wallet.publicKey, false);

  // 4) Create user ATA if missing
  // Desktop: keep 1-click by pre-including ATA ix
  // Phantom Android: do 2 txs (ATA first, then claim) to avoid confirm-button cutoff bug
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

  // 5) Build claim_v2 call
  // NOTE: Anchor exposes claim_v2 as claimV2 (camelCase)
  // V2 wallet-based: no userKeyBytes32 arg (derived on-chain from claimer)
  const claimCall = program.methods
    .claimV2(epochBn, amountBn, index, saltBytes32, proofVec)
    .accounts({
      config: configPda,
      vaultAuthority: vaultAuthorityPda,
      epochRoot: epochRootPda,
      receiptV2: receiptV2Pda,
      claimer: wallet.publicKey,
      vaultAta,
      userAta,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId, // needed for receipt_v2 init
    });

  // 6) Send transaction(s)
  let sig: string;
  if (ixs.length > 0 && isPhantomAndroid()) {
    // ✅ Phantom Android: send ATA in its own tx (small confirm modal)
    const ataTx = new Transaction().add(...ixs);
    await provider.sendAndConfirm(ataTx, [], { commitment });
    // Then claim (ATA now exists)
    sig = await claimCall.rpc({ commitment });
  } else {
    // ✅ Desktop/others: keep 1 tx by pre-including ATA ix when needed
    sig = await claimCall.preInstructions(ixs).rpc({ commitment });
  }

  return { signature: sig };
}

/**
 * Check if a wallet has already claimed for a specific epoch.
 * V2 wallet-based: takes wallet pubkey (base58), not userKeyHex.
 * Returns the receipt PDA address and whether it exists.
 */
export async function checkClaimStatus(opts: {
  epoch: number;
  walletPubkey: string; // base58 wallet address
  connection?: Connection;
}): Promise<{ receiptPda: string; claimed: boolean }> {
  const { epoch, walletPubkey } = opts;
  const connection = opts.connection ?? new Connection(RPC_URL, "confirmed");

  const claimerPubkey = new PublicKey(walletPubkey);
  const receiptV2Pda = findReceiptV2Pda(BigInt(epoch), claimerPubkey);

  const acctInfo = await connection.getAccountInfo(receiptV2Pda, "confirmed");
  const claimed = acctInfo !== null && acctInfo.owner.equals(PROGRAM_ID);

  return {
    receiptPda: receiptV2Pda.toBase58(),
    claimed,
  };
}
