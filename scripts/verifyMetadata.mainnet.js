import { Connection, PublicKey } from "@solana/web3.js";
import pkg from "@metaplex-foundation/mpl-token-metadata";
const { Metadata } = pkg;

// Mainnet RPC
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Your mainnet mint
const MINT_ADDRESS = "HvfmE1stqxvBfUXtKX4L4w3BeMMjcDM48Qh6ZfGtgrpE";
const mint = new PublicKey(MINT_ADDRESS);

// Token Metadata Program
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

(async () => {
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  console.log("Metadata PDA:", metadataPda.toBase58());

  const accountInfo = await connection.getAccountInfo(metadataPda);

  if (!accountInfo) {
    console.log("No metadata account found for this mint.");
    return;
  }

  console.log("Metadata account exists. Data length:", accountInfo.data.length);

  const metadata = Metadata.deserialize(accountInfo.data)[0];

  console.log("On-chain name:", metadata.data.name);
  console.log("On-chain symbol:", metadata.data.symbol);
  console.log("On-chain URI:", metadata.data.uri);
  console.log("Update authority:", metadata.updateAuthority.toBase58());
  console.log("Is mutable:", metadata.isMutable);
})();
