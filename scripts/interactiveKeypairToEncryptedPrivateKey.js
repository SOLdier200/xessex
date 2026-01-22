import readline from "readline";
import crypto from "crypto";
import bs58 from "bs58";

// Prompt helper
function ask(q, hide = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: hide ? undefined : process.stdout,
      terminal: true,
    });

    if (hide) {
      process.stdout.write(q);
      process.stdin.on("data", (char) => {
        char = char + "";
        switch (char) {
          case "\n":
          case "\r":
          case "\u0004":
            process.stdout.write("\n");
            break;
          default:
            process.stdout.write("*");
            break;
        }
      });
    }

    rl.question(q, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
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

  // Convert to base58 private key
  const privateKey58 = bs58.encode(secretKey);

  // Ask for password (hidden input)
  const password = await ask("Enter a password to encrypt your private key: ", true);

  // Derive encryption key from password
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);

  // AES-256-GCM encryption
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(privateKey58, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag().toString("base64");

  // Build encrypted package
  const encryptedPackage = {
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    authTag,
    ciphertext: encrypted,
  };

  console.log("\nEncrypted private key (store this safely):");
  console.log("--------------------------------------------------");
  console.log(JSON.stringify(encryptedPackage));
  console.log("--------------------------------------------------");

  console.log("\nTo decrypt it later, you'll need the same password.");
})();
