import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import fs from "fs";

const PROGRAM_ID = new PublicKey("AKRLZssgxwQwC2gGgUtYtcU7JrhDyEfk1FHqQkZnFUax");
const NEW_MINT = new PublicKey("DYW4Q416BWgwrjLFvr3uVB9HDddkzzGj1RquerMkbZBu");

const rpc = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const keypairPath = process.env.ANCHOR_WALLET || process.env.SOLANA_KEYPAIR || "/root/.config/solana/id.json";

console.log("=== set_mint ===");
console.log("RPC:", rpc);
console.log("Keypair:", keypairPath);
console.log("Program:", PROGRAM_ID.toBase58());
console.log("New Mint:", NEW_MINT.toBase58());

const secret = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
const payer = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secret));
console.log("Admin:", payer.publicKey.toBase58());

const connection = new anchor.web3.Connection(rpc, "confirmed");
const wallet = new anchor.Wallet(payer);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
anchor.setProvider(provider);

const idl = await anchor.Program.fetchIdl(PROGRAM_ID, provider);
if (!idl) throw new Error("IDL_NOT_FOUND (did you deploy/upgrade + anchor idl init?)");

const program = new anchor.Program(idl, provider);

// Config PDA
const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
console.log("Config PDA:", configPda.toBase58());

// Read current config
const configBefore = await program.account.config.fetch(configPda);
console.log("\nCurrent mint:", configBefore.xessMint.toBase58());

const sig = await program.methods
  .setMint(NEW_MINT)
  .accounts({
    config: configPda,
    admin: payer.publicKey,
  })
  .rpc();

console.log("\nset_mint tx:", sig);

// Verify
const configAfter = await program.account.config.fetch(configPda);
console.log("New mint:", configAfter.xessMint.toBase58());
console.log("Success:", configAfter.xessMint.equals(NEW_MINT));
