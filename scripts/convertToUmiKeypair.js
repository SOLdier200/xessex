import fs from "fs";
import { createSignerFromKeypair, createUmi } from "@metaplex-foundation/umi";
import { ed25519 } from "@noble/curves/ed25519";

const raw = JSON.parse(
  fs.readFileSync(`${process.env.HOME}/.config/solana/mainnet-id.json`, "utf8")
);

const secretKey = Uint8Array.from(raw);

// Derive public key from secret key
const publicKey = ed25519.getPublicKey(secretKey.slice(0, 32));

const umiKeypair = {
  publicKey: Array.from(publicKey),
  secretKey: Array.from(secretKey),
};

fs.writeFileSync(
  "keypairs/mainnet-umi.json",
  JSON.stringify(umiKeypair, null, 2)
);

console.log("UMI keypair saved to keypairs/mainnet-umi.json");
