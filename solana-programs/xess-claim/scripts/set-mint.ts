import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

const MINT = new PublicKey("DYW4Q416BWgwrjLFvr3uVB9HDddkzzGj1RquerMkbZBu");

(async () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.XessClaim;
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  const sig = await program.methods
    .setMint(MINT)
    .accounts({
      config: configPda,
      authority: provider.wallet.publicKey,
      xessMint: MINT,
    })
    .rpc();

  console.log("✅ set_mint tx:", sig);
  console.log("✅ config PDA:", configPda.toBase58());
  console.log("✅ mint set to:", MINT.toBase58());
})();
