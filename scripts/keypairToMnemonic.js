import fs from "fs";
import bip39 from "bip39";
import nacl from "tweetnacl";

// Path to your keypair file (id.json, treasury.json, etc.)
const KEYPAIR_PATH = "./treasury.devnet.json";

(async () => {
  // Load keypair
  const secret = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8"));
  const secretKey = Uint8Array.from(secret);

  // Derive seed from the 32-byte private key portion
  const privateKey32 = secretKey.slice(0, 32);

  // Convert to mnemonic
  const mnemonic = bip39.entropyToMnemonic(Buffer.from(privateKey32).toString("hex"));

  console.log("Mnemonic for this keypair:");
  console.log(mnemonic);
})();
