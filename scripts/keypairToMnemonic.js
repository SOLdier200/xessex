import fs from "fs";
import bip39 from "bip39";

const KEYPAIR_PATH = "/home/sol/.config/xessex/PASTE_KEYPAIR_FILENAME.json";

(async () => {
  const secret = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8"));
  const secretKey = Uint8Array.from(secret);

  if (secretKey.length !== 64) {
    console.error("Not a 64-byte Solana keypair.");
    process.exit(1);
  }

  const privateKey32 = secretKey.slice(0, 32);
  const mnemonic = bip39.entropyToMnemonic(
    Buffer.from(privateKey32).toString("hex")
  );

  console.log("Mnemonic:");
  console.log(mnemonic);
})();
