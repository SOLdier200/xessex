import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  setAuthority,
  AuthorityType,
} from "@solana/spl-token";
import fs from "fs";

// Load keypair
const payer = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(`${process.env.HOME}/.config/solana/mainnet-id.json`, "utf8")
    )
  )
);

const connection = new Connection("https://api.mainnet-beta.solana.com");

// Mint
const mint = new PublicKey("HvfmE1stqxvBfUXtKX4L4w3BeMMjcDM48Qh6ZfGtgrpE");

(async () => {
  const sig = await setAuthority(
    connection,
    payer,
    mint,
    payer.publicKey,
    AuthorityType.FreezeAccount,
    null // revoke
  );

  console.log("Freeze authority revoked. Tx:", sig);
})();
