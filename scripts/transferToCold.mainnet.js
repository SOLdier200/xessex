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

// ---------------------------------------------
// CONFIG
// ---------------------------------------------

// Mainnet RPC
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Your Xessex mint
const MINT_ADDRESS = "HvfmE1stqxvBfUXtKX4L4w3BeMMjcDM48Qh6ZfGtgrpE";
const mint = new PublicKey(MINT_ADDRESS);

// Your Ledger cold wallet (paste full address)
const LEDGER_ADDRESS = "2vcxwxXSJpTxZR...Ns5DdCJKVceEnBhMTT31G";
const coldWallet = new PublicKey(LEDGER_ADDRESS);

// Amount to send (150M tokens)
const AMOUNT_TOKENS = 150_000_000n;

// Admin payer (mainnet)
const payer = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(`${process.env.HOME}/.config/solana/mainnet-id.json`, "utf8")
    )
  )
);

// Treasury keypair path
const KEYPAIR_DIR = "/home/sol/.config/xessex/";
const TREASURY_KEYPAIR_PATH = KEYPAIR_DIR + "treasury.mainnet.json";

// ---------------------------------------------
// LOAD OR CREATE TREASURY WALLET
// ---------------------------------------------
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

// ---------------------------------------------
// MAIN
// ---------------------------------------------
(async () => {
  console.log("Mint:", mint.toBase58());
  console.log("Payer (admin):", payer.publicKey.toBase58());
  console.log("Ledger cold wallet:", coldWallet.toBase58());

  const treasury = loadOrCreateTreasuryKeypair();
  console.log("Treasury wallet:", treasury.publicKey.toBase58());

  // Create ATAs if needed
  const payerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );

  const coldAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    coldWallet
  );

  const treasuryAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    treasury.publicKey
  );

  console.log("Payer ATA:", payerAta.address.toBase58());
  console.log("Ledger ATA:", coldAta.address.toBase58());
  console.log("Treasury ATA:", treasuryAta.address.toBase58());

  // Convert token amount to base units (9 decimals)
  const amountBaseUnits = AMOUNT_TOKENS * 10n ** 9n;

  // Transfer to Ledger
  const sig = await transfer(
    connection,
    payer,
    payerAta.address,
    coldAta.address,
    payer,
    amountBaseUnits
  );

  console.log("Transferred 150M XESS to Ledger. Tx:", sig);
})();
