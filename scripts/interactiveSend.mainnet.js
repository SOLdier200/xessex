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

const connection = new Connection("https://api.mainnet-beta.solana.com");
const MINT_ADDRESS = "PASTE_MAINNET_MINT_HERE";
const mint = new PublicKey(MINT_ADDRESS);

const KEYPAIR_DIR = "/home/sol/.config/xessex/";
const TREASURY_KEYPAIR_PATH = KEYPAIR_DIR + "treasury.mainnet.json";

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

  const destWalletStr = await ask("Enter destination wallet: ");
  const destinationWallet = new PublicKey(destWalletStr);

  const amountStr = await ask("Enter how many whole tokens to send: ");
  const sendAmountTokens = BigInt(amountStr);

  const treasuryChoice = await ask("Send tokens to treasury? (yes/no): ");

  let treasuryAmountTokens = 0n;
  const treasury = loadOrCreateTreasuryKeypair();

  if (treasuryChoice.toLowerCase() === "yes") {
    const treasuryAmountStr = await ask("Enter treasury amount: ");
    treasuryAmountTokens = BigInt(treasuryAmountStr);
  }

  console.log("Treasury wallet:", treasury.publicKey.toBase58());

  const payerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );

  const destAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    destinationWallet
  );

  const treasuryAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    treasury.publicKey
  );

  const sendAmountBaseUnits = sendAmountTokens * 10n ** 9n;
  const treasuryAmountBaseUnits = treasuryAmountTokens * 10n ** 9n;

  const sig1 = await transfer(
    connection,
    payer,
    payerAta.address,
    destAta.address,
    payer,
    sendAmountBaseUnits
  );
  console.log("Sent to destination. Tx:", sig1);

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
