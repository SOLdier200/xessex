import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";

const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_XESS_CLAIM_PROGRAM_ID!);
const XESS_MINT = new PublicKey(process.env.XESS_MINT!);
const VAULT_ATA = new PublicKey(process.env.XESS_VAULT_ATA || process.env.XESS_TREASURY_ATA || process.env.XESS_ATA!);

function u64LE(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // ========== TESTING MODE (bypasses DB entirely) ==========
  // For testing single-leaf merkle tree with CLI wallet
  // Set XESS_CLAIM_TESTMODE=1 in .env.local to enable
  const testMode = process.env.XESS_CLAIM_TESTMODE === "1";
  const TEST_CLAIMER = "J1ssN9Fr6qeNN1CUphVV8XaaPbx2YHpt1gv9SLupJTMe";

  if (testMode) {
    // In test mode, use the test claimer directly (no DB/auth needed)
    const claimerPk = new PublicKey(TEST_CLAIMER);
    const epoch = 3n; // Test epoch 3 (using keccak256 hash)
    const amountAtomic = 1000000000n; // 1.0 XESS - MUST match ROOT generator
    const index = 0;
    const proof: number[][] = [];

    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_authority"), configPda.toBuffer()],
      PROGRAM_ID
    );
    const [epochRootPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("epoch_root"), u64LE(epoch)],
      PROGRAM_ID
    );
    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), u64LE(epoch), claimerPk.toBuffer()],
      PROGRAM_ID
    );

    // Check if already claimed (receipt exists on-chain)
    const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpc, "confirmed");
    const receiptInfo = await connection.getAccountInfo(receiptPda);

    if (receiptInfo && receiptInfo.owner.equals(PROGRAM_ID)) {
      return NextResponse.json({
        ok: true,
        claimable: false,
        reason: "already_claimed",
        epoch: epoch.toString(),
        receipt: receiptPda.toBase58(),
        testMode: true,
      });
    }

    return NextResponse.json({
      ok: true,
      claimable: true,
      epoch: epoch.toString(),
      amountAtomic: amountAtomic.toString(),
      index,
      proof,
      programId: PROGRAM_ID.toBase58(),
      xessMint: XESS_MINT.toBase58(),
      vaultAta: VAULT_ATA.toBase58(),
      claimer: claimerPk.toBase58(),
      pdas: {
        config: configPda.toBase58(),
        vaultAuthority: vaultAuthority.toBase58(),
        epochRoot: epochRootPda.toBase58(),
        receipt: receiptPda.toBase58(),
      },
      testMode: true,
    });
  }
  // ========== END TESTING MODE ==========

  // ========== PRODUCTION MODE ==========
  // Uses ClaimEpoch/ClaimLeaf tables for merkle proofs
  const ctx = await getAccessContext();
  if (!ctx.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Wallet must be linked because claim is wallet-signed
  const wallet = (ctx.user.solWallet || ctx.user.walletAddress || "").trim();
  if (!wallet) return NextResponse.json({ error: "no_wallet_linked" }, { status: 400 });

  const claimerPk = new PublicKey(wallet);

  // Get the latest epoch with a root set on-chain
  const epochRow = await db.claimEpoch.findFirst({
    where: { setOnChain: true },
    orderBy: { epoch: "desc" },
  });

  if (!epochRow) {
    return NextResponse.json({
      ok: true,
      claimable: false,
      reason: "no_epoch",
    });
  }

  // Get user's leaf for this epoch
  const leaf = await db.claimLeaf.findUnique({
    where: { epoch_wallet: { epoch: epochRow.epoch, wallet } },
  });

  if (!leaf) {
    return NextResponse.json({
      ok: true,
      claimable: false,
      reason: "no_allocation",
      epoch: epochRow.epoch,
    });
  }

  const epoch = BigInt(epochRow.epoch);

  // Compute PDAs
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority"), configPda.toBuffer()],
    PROGRAM_ID
  );
  const [epochRootPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("epoch_root"), u64LE(epoch)],
    PROGRAM_ID
  );
  const [receiptPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), u64LE(epoch), claimerPk.toBuffer()],
    PROGRAM_ID
  );

  // Check if already claimed on-chain
  const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");
  const receiptInfo = await connection.getAccountInfo(receiptPda);

  if (receiptInfo && receiptInfo.owner.equals(PROGRAM_ID)) {
    return NextResponse.json({
      ok: true,
      claimable: false,
      reason: "already_claimed",
      epoch: epoch.toString(),
      receipt: receiptPda.toBase58(),
    });
  }

  // Return claim data with proof
  return NextResponse.json({
    ok: true,
    claimable: true,
    epoch: epoch.toString(),
    amountAtomic: leaf.amountAtomic.toString(),
    index: leaf.index,
    proof: leaf.proofHex, // array of hex strings
    programId: PROGRAM_ID.toBase58(),
    xessMint: XESS_MINT.toBase58(),
    vaultAta: VAULT_ATA.toBase58(),
    claimer: claimerPk.toBase58(),
    pdas: {
      config: configPda.toBase58(),
      vaultAuthority: vaultAuthority.toBase58(),
      epochRoot: epochRootPda.toBase58(),
      receipt: receiptPda.toBase58(),
    },
  });
}
