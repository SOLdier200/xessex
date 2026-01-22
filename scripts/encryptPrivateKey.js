import readline from "readline";
import crypto from "crypto";
import bs58 from "bs58";

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
        if (["\n", "\r", "\u0004"].includes(char)) {
          process.stdout.write("\n");
        } else {
          process.stdout.write("*");
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
  console.log("Paste your keypair array (e.g. [1,2,3,...]):");
  const arrayInput = await ask("> ");

  let arr;
  try {
    arr = JSON.parse(arrayInput);
  } catch {
    console.error("Invalid JSON array.");
    process.exit(1);
  }

  const secretKey = Uint8Array.from(arr);
  if (secretKey.length !== 64) {
    console.error("Not a 64-byte Solana keypair.");
    process.exit(1);
  }

  const privateKey58 = bs58.encode(secretKey);

  const password = await ask("Password to encrypt: ", true);

  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(privateKey58, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag().toString("base64");

  const encryptedPackage = {
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    authTag,
    ciphertext: encrypted,
  };

  console.log("\nEncrypted private key JSON:");
  console.log(JSON.stringify(encryptedPackage));
})();
