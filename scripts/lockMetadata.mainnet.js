import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createUpdateMetadataAccountV2Instruction,
} from "@metaplex-foundation/mpl-token-metadata";
import fs from "fs";

// Load your mainnet keypair
const payer = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(`${process.env.HOME}/.config/solana/mainnet-id.json`, "utf8")
    )
  )
);

const connection = new Connection("https://api.mainnet-beta.solana.com");

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Your mint
const mint = new PublicKey("HvfmE1stqxvBfUXtKX4L4w3BeMMjcDM48Qh6ZfGtgrpE");

(async () => {
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  const ix = createUpdateMetadataAccountV2Instruction(
    {
      metadata: metadataPda,
      updateAuthority: payer.publicKey,
    },
    {
      updateMetadataAccountArgsV2: {
        data: null,          // keep existing metadata
        updateAuthority: null, // remove update authority
        primarySaleHappened: null,
        isMutable: false,     // <-- LOCK METADATA
      },
    }
  );

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer]);

  console.log("Metadata locked (immutable). Tx:", sig);
})();
