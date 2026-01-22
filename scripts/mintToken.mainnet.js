import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import pkg from "@metaplex-foundation/mpl-token-metadata";
const { createCreateMetadataAccountV3Instruction } = pkg;
import fs from "fs";

// Payer: Solana CLI keypair
const payer = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf8")
    )
  )
);

const connection = new Connection("https://api.mainnet-beta.solana.com");

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

(async () => {
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    9,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  );

  console.log("Mint:", mint.toBase58());

  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );

  const totalSupply = 1_000_000_000n * 10n ** 9n;

  await mintTo(connection, payer, mint, ata.address, payer, totalSupply);

  console.log("Minted supply:", totalSupply.toString());

  const [metadataPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  const metadataIx = createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataPda,
      mint,
      mintAuthority: payer.publicKey,
      payer: payer.publicKey,
      updateAuthority: payer.publicKey,
    },
    {
      createMetadataAccountArgsV3: {
        data: {
          name: "Xessex",
          symbol: "XESS",
          uri: "https://xessex.me/metadata.json",
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: true,
        collectionDetails: null,
      },
    }
  );

  const tx = new Transaction().add(metadataIx);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer]);

  console.log("Metadata tx:", sig);
  console.log("Authorities NOT revoked. Review everything before locking.");
})();
