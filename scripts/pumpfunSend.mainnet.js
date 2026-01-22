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

// ---------- CONFIG ----------

// Mainnet RPC
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Your mainnet mint
const MINT_ADDRESS = "PASTE_MAINNET_MINT_HERE";
const mint = new PublicKey(MINT_ADDRESS);

// Keypair directory
const KEYPAIR_DIR = "/home/sol/.config/xessex/";
const TREASURY_KEYPAIR_PATH = KEYPAIR_DIR + "treasury.mainnet.json";

// Load payer (Solana CLI)
const payer = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf8")
    )
  )
);

// Load or create treasury keypair
function loadOrCreateTreasuryKeypair() {
  if (fs.existsSync(TREASURY_KEYPAIR_PATH)) {
    return Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(TREASURY_KEYPAIR_PATH)))
    );
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

// Prompt helper
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

  // Pump.fun wallet address (user chooses)
  const pumpWalletStr = await ask("Enter the pump.fun wallet address: ");
  const pumpWallet = new PublicKey(pumpWalletStr);

  // Amount to send
  const amountStr = await ask("Enter how many whole tokens to send to pump.fun: ");
  const sendAmountTokens = BigInt(amountStr);

  // Treasury optional
  const treasuryChoice = await ask("Send tokens to treasury as well? (yes/no): ");

  let treasuryAmountTokens = 0n;
  const treasury = loadOrCreateTreasuryKeypair();

  if (treasuryChoice.toLowerCase() === "yes") {
    const treasuryAmountStr = await ask("Enter how many tokens to send to treasury: ");
    treasuryAmountTokens = BigInt(treasuryAmountStr);
  }

  console.log("Treasury wallet:", treasury.publicKey.toBase58());

  // Create ATAs
  const payerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );

  const pumpAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    pumpWallet
  );

  const treasuryAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    treasury.publicKey
  );

  console.log("Payer ATA:", payerAta.address.toBase58());
  console.log("Pump.fun ATA:", pumpAta.address.toBase58());
  console.log("Treasury ATA:", treasuryAta.address.toBase58());

  // Convert to base units
  const sendAmountBaseUnits = sendAmountTokens * 10n ** 9n;
  const treasuryAmountBaseUnits = treasuryAmountTokens * 10n ** 9n;

  // Transfer to pump.fun
  const sig1 = await transfer(
    connection,
    payer,
    payerAta.address,
    pumpAta.address,
    payer,
    sendAmountBaseUnits
  );
  console.log("Sent to pump.fun. Tx:", sig1);

  // Optional treasury transfer
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
