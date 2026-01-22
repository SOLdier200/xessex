import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  setAuthority,
  AuthorityType,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import fs from "fs";

// RPC: switch between devnet / mainnet here
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Mint you want to lock
const MINT_ADDRESS = "PASTE_MINT_ADDRESS_HERE";
const mint = new PublicKey(MINT_ADDRESS);

// Load your Solana CLI keypair
const secret = JSON.parse(
  fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf8")
);
const payer = Keypair.fromSecretKey(new Uint8Array(secret));

(async () => {
  console.log("Mint:", mint.toBase58());

  // Revoke mint authority
  await setAuthority(
    connection,
    payer,
    mint,
    payer.publicKey,
    AuthorityType.MintTokens,
    null,
    [],
    undefined,
    TOKEN_PROGRAM_ID
  );
  console.log("Mint authority revoked.");

  // Revoke freeze authority
  await setAuthority(
    connection,
    payer,
    mint,
    payer.publicKey,
    AuthorityType.FreezeAccount,
    null,
    [],
    undefined,
    TOKEN_PROGRAM_ID
  );
  console.log("Freeze authority revoked.");

  console.log("Token is now fixed-supply and unfreezable.");
})();
