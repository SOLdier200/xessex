import readline from "readline";
import bip39 from "bip39";
import nacl from "tweetnacl";
import bs58 from "bs58";

// Prompt helper
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
  console.log("Paste your Solana keypair array (e.g. [12,34,56,...]):");

  const arrayInput = await ask("> ");

  let arr;
  try {
    arr = JSON.parse(arrayInput);
  } catch (e) {
    console.error("Invalid array. Make sure it's valid JSON like: [1,2,3,...]");
    process.exit(1);
  }

  const secretKey = Uint8Array.from(arr);

  if (secretKey.length !== 64) {
    console.error("This is not a valid 64-byte Solana keypair.");
    process.exit(1);
  }

  // Extract the first 32 bytes (actual private key)
  const privateKey32 = secretKey.slice(0, 32);

  // Convert to mnemonic
  const mnemonic = bip39.entropyToMnemonic(Buffer.from(privateKey32).toString("hex"));

  console.log("\nYour mnemonic phrase:");
  console.log("--------------------------------------------------");
  console.log(mnemonic);
  console.log("--------------------------------------------------");

  // Verify by regenerating the keypair from mnemonic
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const derived = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));

  const originalPub = bs58.encode(nacl.sign.keyPair.fromSecretKey(secretKey).publicKey);
  const derivedPub = bs58.encode(derived.publicKey);

  console.log("\nVerification:");
  console.log("Original pubkey:", originalPub);
  console.log("Mnemonic pubkey:", derivedPub);

  if (originalPub === derivedPub) {
    console.log("\n✔ SUCCESS — This mnemonic restores the SAME keypair.");
  } else {
    console.log("\n⚠ WARNING — Derived keypair does NOT match the original.");
  }
})();
