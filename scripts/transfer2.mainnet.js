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

// RPC
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Mint
const MINT = new PublicKey("HvfmE1stqxvBfUXtKX4L4w3BeMMjcDM48Qh6ZfGtgrpE");

// Destination wallet
const DEST = new PublicKey("9cchV33nXWxT5HqgjtanfudpGqgAg26Nd2eWFU2sPbWi");

// Amount: 2 tokens
const AMOUNT = 2n;

// Payer (mainnet admin)
const payer = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(`${process.env.HOME}/.config/solana/mainnet-id.json`, "utf8")
    )
  )
);

(async () => {
  console.log("Mint:", MINT.toBase58());
  console.log("Payer:", payer.publicKey.toBase58());
  console.log("Destination:", DEST.toBase58());

  // Get ATAs
  const payerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    MINT,
    payer.publicKey
  );

  const destAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    MINT,
    DEST
  );

  console.log("Payer ATA:", payerAta.address.toBase58());
  console.log("Destination ATA:", destAta.address.toBase58());

  // Convert to base units (9 decimals)
  const amountBaseUnits = AMOUNT * 10n ** 9n;

  const sig = await transfer(
    connection,
    payer,
    payerAta.address,
    destAta.address,
    payer,
    amountBaseUnits
  );

  console.log("Transferred 2 XESS. Tx:", sig);
})();
