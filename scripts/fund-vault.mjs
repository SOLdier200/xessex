import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAccount } from "@solana/spl-token";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_XESS_CLAIM_PROGRAM_ID);
const XESS_MINT = new PublicKey(process.env.XESS_MINT);

// Compute PDAs
const [configPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  PROGRAM_ID
);

const [vaultAuthority] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault_authority"), configPda.toBuffer()],
  PROGRAM_ID
);

// Compute the vault ATA (owned by vaultAuthority PDA)
const vaultAta = getAssociatedTokenAddressSync(XESS_MINT, vaultAuthority, true);

console.log("=== XESS Claim Vault Info ===");
console.log("Program ID:      ", PROGRAM_ID.toBase58());
console.log("XESS Mint:       ", XESS_MINT.toBase58());
console.log("Config PDA:      ", configPda.toBase58());
console.log("Vault Authority: ", vaultAuthority.toBase58());
console.log("Vault ATA:       ", vaultAta.toBase58());
console.log("");
console.log("Set this in your .env:");
console.log("XESS_VAULT_ATA=" + vaultAta.toBase58());
