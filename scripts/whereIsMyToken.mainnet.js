import { Connection, PublicKey } from "@solana/web3.js";
import { getMint, getAccount } from "@solana/spl-token";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const MINT_ADDRESS = "PASTE_MAINNET_MINT_HERE";
const mint = new PublicKey(MINT_ADDRESS);

(async () => {
  const mintInfo = await getMint(connection, mint);
  const decimals = mintInfo.decimals;

  const accounts = await connection.getProgramAccounts(
    new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    {
      filters: [
        { dataSize: 165 },
        { memcmp: { offset: 0, bytes: mint.toBase58() } },
      ],
    }
  );

  let total = 0n;

  for (const acct of accounts) {
    const info = await getAccount(connection, acct.pubkey);
    const owner = info.owner.toBase58();
    const amount = info.amount;

    total += amount;

    console.log("Owner:", owner);
    console.log("Token Account:", acct.pubkey.toBase58());
    console.log("Balance:", Number(amount) / 10 ** decimals);
    console.log("--------------------------------------");
  }

  console.log("Total supply accounted for:", Number(total) / 10 ** decimals);
})();
