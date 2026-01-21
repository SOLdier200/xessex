import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import pkg from "@metaplex-foundation/mpl-token-metadata";
const {
  createUpdateMetadataAccountV2Instruction,
} = pkg;
import fs from "fs";

// RPC: switch between devnet / mainnet here
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Mint whose metadata you want to update
const MINT_ADDRESS = "PASTE_MINT_ADDRESS_HERE";
const mint = new PublicKey(MINT_ADDRESS);

// Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Load your Solana CLI keypair (must be updateAuthority)
const secret = JSON.parse(
  fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf8")
);
const payer = Keypair.fromSecretKey(new Uint8Array(secret));

(async () => {
  // Derive metadata PDA
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  // New metadata values
  const newData = {
    name: "Xessex", // update if needed
    symbol: "XESS",
    uri: "https://xessex.me/metadata.json", // point to updated JSON if you change logo/fields
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null,
  };

  const ix = createUpdateMetadataAccountV2Instruction(
    {
      metadata: metadataPda,
      updateAuthority: payer.publicKey,
    },
    {
      updateMetadataAccountArgsV2: {
        data: newData,
        updateAuthority: payer.publicKey, // keep yourself as update authority
        primarySaleHappened: null,
        isMutable: true, // keep mutable until you're 100% ready
      },
    }
  );

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer]);

  console.log("Metadata updated. Tx:", sig);
})();
