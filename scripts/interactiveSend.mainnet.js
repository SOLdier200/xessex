import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
} from "@solana/spl-token";
import fs from "fs";
import readline from "readline";

// ---------------- CONFIG ----------------

// MAINNET RPC
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Your mainnet mint address
const MINT_ADDRESS = "PASTE_MAINNET_MINT_HERE";
const mint = new PublicKey(MINT_ADDRESS);

// Treasury keypair file (mainnet)
const TREASURY_KEYPAIR_PATH = "./treasury.mainnet.json";

// ----------------------------------------

// Load your Solana CLI keypair (payer/owner of supply)
const secret = JSON.parse(
  fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf8")
);
const payer = Keypair.fromSecretKey(new Uint8Array(secret));

function loadOrCreateTreasuryKeypair() {
  if (fs.existsSync(TREASURY_KEYPAIR_PATH)) {
    const raw = JSON.parse(fs.readFileSync(TREASURY_KEYPAIR_PATH, "utf8"));
    return Keypair.fromSecretKey(new Uint8Array(raw));
  } else {
    const kp = Keypair.generate();
    fs.writeFileSync(
      TREASURY_KEYPAIR_PATH,
      JSON.stringify(Array.from(kp.secretKey))
    );
    console.log("Created new treasury keypair:", kp.publicKey.toBase58());
    return kp;
  }
}

// Simple prompt helper
function ask(q) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(q, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

(async () => {
  console.log("Mint:", mint.toBase58());
  console.log("Payer:", payer.publicKey.toBase58());

  // Prompt for destination wallet
  const destWalletStr = await ask("Enter the wallet address to send tokens to: ");
  const destinationWallet = new PublicKey(destWalletStr);

  // Prompt for amount
  const amountStr = await ask("Enter how many whole tokens to send: ");
  const sendAmountTokens = BigInt(amountStr);

  // Ask if user wants to fund treasury
  const treasuryChoice = await ask("Do you want to send tokens to the treasury wallet? (yes/no): ");

  let treasuryAmountTokens = 0n;
  const treasury = loadOrCreateTreasuryKeypair();

  if (treasuryChoice.toLowerCase() === "yes") {
    const treasuryAmountStr = await ask("Enter how many whole tokens to send to treasury: ");
    treasuryAmountTokens = BigInt(treasuryAmountStr);
  }

  console.log("Treasury wallet:", treasury.publicKey.toBase58());

  // 1. Payer ATA (source)
  const payerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );
  console.log("Payer ATA:", payerAta.address.toBase58());

  // 2. Destination ATA
  const destAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    destinationWallet
  );
  console.log("Destination ATA:", destAta.address.toBase58());

  // 3. Treasury ATA
  const treasuryAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    treasury.publicKey
  );
  console.log("Treasury ATA:", treasuryAta.address.toBase58());

  // Convert whole tokens → base units (9 decimals)
  const sendAmountBaseUnits = sendAmountTokens * 10n ** 9n;
  const treasuryAmountBaseUnits = treasuryAmountTokens * 10n ** 9n;

  // 4. Transfer to destination
  const sig1 = await transfer(
    connection,
    payer,
    payerAta.address,
    destAta.address,
    payer,
    sendAmountBaseUnits
  );
  console.log("Sent to destination. Tx:", sig1);

  // 5. Optional: fund treasury
  if (treasuryAmountTokens > 0n) {
    const sig2 = await transfer(
      connection,
      payer,
      payerAta.address,
      treasuryAta.address,
      payer,
      treasuryAmountBaseUnits
    );
    console.log("Treasury funded. Tx:", sig2);
  }

  console.log("Done.");
})();
