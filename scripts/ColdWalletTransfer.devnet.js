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

// ---------- CONFIG ----------

// Devnet RPC
const connection = new Connection("https://api.devnet.solana.com");

// Your mint (from createToken.devnet.js output)
const MINT_ADDRESS = "DYW4Q416BWgwrjLFvr3uVB9HDddkzzGj1RquerMkbZBu";
const mint = new PublicKey(MINT_ADDRESS);

// Cold wallet public key (string from Phantom, etc.)
const COLD_WALLET_ADDRESS = "3HztXasxNEMASQErs3RUucZtzNCRdH7xuKnMb5PrTdiS";
const coldWallet = new PublicKey(COLD_WALLET_ADDRESS);

// Treasury wallet keypair file
const TREASURY_KEYPAIR_PATH = "./treasury.json";

// Amounts (in whole tokens)
const COLD_WALLET_TOKENS = 150_000_000n; // 150M
// ----------------------------

// Load your Solana CLI keypair (payer/owner of initial supply)
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

(async () => {
  console.log("Mint:", mint.toBase58());
  console.log("Payer:", payer.publicKey.toBase58());
  console.log("Cold wallet:", coldWallet.toBase58());

  const treasury = loadOrCreateTreasuryKeypair();
  console.log("Treasury wallet:", treasury.publicKey.toBase58());

  // 1. Get payer ATA (source)
  const payerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );
  console.log("Payer ATA:", payerAta.address.toBase58());

  // 2. Get/create cold wallet ATA (destination)
  const coldAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,        // payer for ATA creation
    mint,
    coldWallet
  );
  console.log("Cold wallet ATA:", coldAta.address.toBase58());

  // 3. Get/create treasury ATA
  const treasuryAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,        // payer for ATA creation
    mint,
    treasury.publicKey
  );
  console.log("Treasury ATA:", treasuryAta.address.toBase58());

  // 4. Transfer 150M tokens (remember 9 decimals)
  const amountBaseUnits = COLD_WALLET_TOKENS * 10n ** 9n;

  const sig = await transfer(
    connection,
    payer,
    payerAta.address,
    coldAta.address,
    payer, // owner of source ATA
    amountBaseUnits
  );

  console.log("Transferred to cold wallet. Tx:", sig);
})();
