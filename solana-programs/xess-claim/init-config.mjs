import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROGRAM_ID = new PublicKey("AKRLZssgxwQwC2gGgUtYtcU7JrhDyEfk1FHqQkZnFUax");
const ADMIN = new PublicKey("J1ssN9Fr6qeNN1CUphVV8XaaPbx2YHpt1gv9SLupJTMe"); // CLI wallet
const XESS_MINT = new PublicKey("FDq2CeHd9QeMSH69Picd7bVRBf3n8rHM2Us4vctNUzdT");

const RPC_URL = "https://api.devnet.solana.com";

async function main() {
  const walletPath = path.resolve(process.env.HOME, ".config/solana/devnet-id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  // Load IDL from file
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "target/idl/xess_claim.json"), "utf8"));
  const program = new anchor.Program(idl, provider);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );

  const [vaultAuthPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority"), configPda.toBuffer()],
    PROGRAM_ID
  );

  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("Admin:", ADMIN.toBase58());
  console.log("XESS Mint:", XESS_MINT.toBase58());
  console.log("Config PDA:", configPda.toBase58());
  console.log("Vault Authority PDA:", vaultAuthPda.toBase58());
  console.log("Payer:", keypair.publicKey.toBase58());

  try {
    const sig = await program.methods
      .initialize(ADMIN)
      .accounts({
        config: configPda,
        vaultAuthority: vaultAuthPda,
        xessMint: XESS_MINT,
        payer: keypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("\nInitialize TX:", sig);
    console.log("View on explorer: https://explorer.solana.com/tx/" + sig + "?cluster=devnet");
  } catch (err) {
    if (err.message?.includes("already in use")) {
      console.log("\nConfig already initialized!");
    } else {
      throw err;
    }
  }
}

main().catch(console.error);
