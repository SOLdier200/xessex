import readline from "readline";
import crypto from "crypto";
import bs58 from "bs58";
import nacl from "tweetnacl";

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
  console.log("Paste encrypted JSON:");
  const encryptedInput = await ask("> ");

  let data;
  try {
    data = JSON.parse(encryptedInput);
  } catch {
    console.error("Invalid JSON.");
    process.exit(1);
  }

  const password = await ask("Password: ", true);

  try {
    const salt = Buffer.from(data.salt, "base64");
    const iv = Buffer.from(data.iv, "base64");
    const authTag = Buffer.from(data.authTag, "base64");
    const ciphertext = Buffer.from(data.ciphertext, "base64");

    const key = crypto.scryptSync(password, salt, 32);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, "base64", "utf8");
    decrypted += decipher.final("utf8");

    const privateKey58 = decrypted;

    console.log("\nDecrypted private key:");
    console.log(privateKey58);

    const secretKey = bs58.decode(privateKey58);
    const pub = nacl.sign.keyPair.fromSecretKey(secretKey).publicKey;

    console.log("Public key:", bs58.encode(pub));
  } catch {
    console.error("Failed to decrypt.");
  }
})();
