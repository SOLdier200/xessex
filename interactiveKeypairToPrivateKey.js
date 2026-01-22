import readline from "readline";
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

  // Convert full 64-byte secret key to base58 private key
  const privateKey58 = bs58.encode(secretKey);

  console.log("\nYour base58 private key:");
  console.log("--------------------------------------------------");
  console.log(privateKey58);
  console.log("--------------------------------------------------");

  console.log("\nThis private key can be imported into wallets that accept raw secret keys.");
})();
