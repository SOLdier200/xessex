import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROGRAM_ID = new PublicKey("AKRLZssgxwQwC2gGgUtYtcU7JrhDyEfk1FHqQkZnFUax");

// Safety guards - prevent accidental zero roots or missing args
if (!process.argv[2] || !process.argv[3]) {
  console.error("Usage: node set-epoch-root.mjs <EPOCH> <ROOT_HEX>");
  console.error("Example: node set-epoch-root.mjs 1 a1b2c3...64chars");
  process.exit(1);
}

const EPOCH = BigInt(process.argv[2]);
const ROOT_HEX = process.argv[3].replace(/^0x/, "");

if (!/^[0-9a-fA-F]{64}$/.test(ROOT_HEX)) {
  console.error("ERROR: ROOT_HEX must be exactly 64 hex characters (32 bytes).");
  console.error("Got:", ROOT_HEX.length, "chars");
  process.exit(1);
}

if (/^0{64}$/.test(ROOT_HEX)) {
  console.error("ERROR: Refusing to set all-zero root. This is likely a mistake.");
  process.exit(1);
}

const RPC_URL = "https://api.devnet.solana.com";

function hexTo32(hex) {
  const cleaned = hex.replace(/^0x/, "");
  const out = [];
  for (let i = 0; i < 64; i += 2) out.push(parseInt(cleaned.slice(i, i + 2), 16));
  return out;
}

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

  const epochBuf = Buffer.alloc(8);
  epochBuf.writeBigUInt64LE(EPOCH);

  const [epochRootPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("epoch_root"), epochBuf],
    PROGRAM_ID
  );

  console.log("Epoch:", EPOCH.toString());
  console.log("Root (hex):", ROOT_HEX);
  console.log("Config PDA:", configPda.toBase58());
  console.log("Epoch Root PDA:", epochRootPda.toBase58());
  console.log("Admin/Payer:", keypair.publicKey.toBase58());

  const rootArr = hexTo32(ROOT_HEX);

  try {
    const sig = await program.methods
      .setEpochRoot(new BN(EPOCH.toString()), rootArr)
      .accounts({
        config: configPda,
        epochRoot: epochRootPda,
        admin: keypair.publicKey,
        payer: keypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("\nSet Epoch Root TX:", sig);
    console.log("View on explorer: https://explorer.solana.com/tx/" + sig + "?cluster=devnet");
  } catch (err) {
    if (err.message?.includes("already in use")) {
      console.log("\nEpoch root already set!");
    } else {
      throw err;
    }
  }
}

main().catch(console.error);
