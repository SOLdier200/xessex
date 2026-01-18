import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("AKRLZssgxwQwC2gGgUtYtcU7JrhDyEfk1FHqQkZnFUax");

// set this to your admin pubkey
const ADMIN = new PublicKey("J1ssN9FrqLLkNgsUxHPTg9MkM6weVk1X9v54vWS1G3BL");

// set this to your XESS mint on devnet
const XESS_MINT = new PublicKey(process.env.XESS_MINT!);

describe("xess-claim init", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  it("initialize config", async () => {
    const idl = await anchor.Program.fetchIdl(PROGRAM_ID, provider);
    if (!idl) throw new Error("IDL not found on-chain. Did you deploy?");
    const program = new anchor.Program(idl, provider);

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      PROGRAM_ID
    );

    const [vaultAuthPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_authority"), configPda.toBuffer()],
      PROGRAM_ID
    );

    console.log("configPda:", configPda.toBase58());
    console.log("vaultAuthPda:", vaultAuthPda.toBase58());

    const sig = await program.methods
      .initialize(ADMIN)
      .accounts({
        config: configPda,
        vaultAuthority: vaultAuthPda,
        xessMint: XESS_MINT,
        payer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("initialize tx:", sig);
  });
});
