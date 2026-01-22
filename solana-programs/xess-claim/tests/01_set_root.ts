import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("HR2Kw7Sji8UceEgETARrCTRaduX5tdQ4bfEHz7yWzyD9");

const EPOCH = BigInt(process.env.EPOCH || "1");
const ROOT_HEX = (process.env.ROOT_HEX || "").replace(/^0x/, "");
if (ROOT_HEX.length !== 64) throw new Error("ROOT_HEX must be 32 bytes hex (64 chars)");

function hexTo32(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < 64; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

describe("xess-claim set root", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  it("set epoch root", async () => {
    const idl = await anchor.Program.fetchIdl(PROGRAM_ID, provider);
    if (!idl) throw new Error("IDL not found on-chain.");
    const program = new anchor.Program(idl as anchor.Idl, PROGRAM_ID, provider);

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      PROGRAM_ID
    );

    const epochBuf = Buffer.alloc(8);
    epochBuf.writeBigUInt64LE(EPOCH);

    const [epochRootPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("epoch_root"), epochBuf],
      PROGRAM_ID
    );

    console.log("epoch:", EPOCH.toString());
    console.log("epochRootPda:", epochRootPda.toBase58());

    const rootArr = hexTo32(ROOT_HEX);

    const sig = await program.methods
      .setEpochRoot(new anchor.BN(EPOCH.toString()), rootArr as any)
      .accounts({
        config: configPda,
        epochRoot: epochRootPda,
        admin: provider.wallet.publicKey,
        payer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("set_epoch_root tx:", sig);
  });
});
