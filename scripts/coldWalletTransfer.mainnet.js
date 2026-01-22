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

// Mainnet RPC
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Mainnet mint
const MINT_ADDRESS = "PASTE_MAINNET_MINT_HERE";
const mint = new PublicKey(MINT_ADDRESS);

// Cold wallet
const COLD_WALLET_ADDRESS = "PASTE_COLD_WALLET_HERE";
const coldWallet = new PublicKey(COLD_WALLET_ADDRESS);

// Keypair dir
const KEYPAIR_DIR = "/home/sol/.config/xessex/";
const TREASURY_KEYPAIR_PATH = KEYPAIR_DIR + "treasury.mainnet.json";

// Amount
const COLD_WALLET_TOKENS = 150_000_000n;

// Payer (CLI)
const payer = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf8")
    )
  )
);

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

(async () => {
  console.log("Mint:", mint.toBase58());
  console.log("Payer:", payer.publicKey.toBase58());
  console.log("Cold wallet:", coldWallet.toBase58());

  const treasury = loadOrCreateTreasuryKeypair();
  console.log("Treasury wallet:", treasury.publicKey.toBase58());

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
  console.log("Cold wallet ATA:", coldAta.address.toBase58());
  console.log("Treasury ATA:", treasuryAta.address.toBase58());

  const amountBaseUnits = COLD_WALLET_TOKENS * 10n ** 9n;

  const sig = await transfer(
    connection,
    payer,
    payerAta.address,
    coldAta.address,
    payer,
    amountBaseUnits
  );

  console.log("Transferred to cold wallet. Tx:", sig);
})();
