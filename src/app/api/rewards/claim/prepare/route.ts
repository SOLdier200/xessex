import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";

// Lazy-loaded to avoid build-time failures when env vars are not set
function getProgramId() {
  return new PublicKey(process.env.NEXT_PUBLIC_XESS_CLAIM_PROGRAM_ID!);
}
function getXessMint() {
  return new PublicKey(process.env.XESS_MINT!);
}
function getVaultAta() {
  return new PublicKey(process.env.XESS_VAULT_ATA || process.env.XESS_TREASURY_ATA || process.env.XESS_ATA!);
}

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

    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], getProgramId());
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_authority"), configPda.toBuffer()],
      getProgramId()
    );
    const [epochRootPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("epoch_root"), u64LE(epoch)],
      getProgramId()
    );
    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), u64LE(epoch), claimerPk.toBuffer()],
      getProgramId()
    );

    // Check if already claimed (receipt exists on-chain)
    const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpc, "confirmed");
    const receiptInfo = await connection.getAccountInfo(receiptPda);

    if (receiptInfo && receiptInfo.owner.equals(getProgramId())) {
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
      programId: getProgramId().toBase58(),
      xessMint: getXessMint().toBase58(),
      vaultAta: getVaultAta().toBase58(),
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

  console.log("[claim/prepare] User:", ctx.user.id, "Wallet:", wallet);
  console.log("[claim/prepare] Latest on-chain epoch:", epochRow ? `#${epochRow.epoch} (weekKey: ${epochRow.weekKey})` : "NONE");

  if (!epochRow) {
    // Debug: show all epochs
    const allEpochs = await db.claimEpoch.findMany({ orderBy: { epoch: "desc" }, take: 5 });
    console.log("[claim/prepare] All epochs:", allEpochs.map(e => ({ epoch: e.epoch, weekKey: e.weekKey, setOnChain: e.setOnChain })));
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

  console.log("[claim/prepare] Leaf for wallet in epoch", epochRow.epoch, ":", leaf ? `index=${leaf.index}, amount=${leaf.amountAtomic}` : "NOT FOUND");

  if (!leaf) {
    // Debug: show all leaves for this epoch
    const allLeaves = await db.claimLeaf.findMany({ where: { epoch: epochRow.epoch }, take: 10 });
    console.log("[claim/prepare] All leaves in epoch:", allLeaves.map(l => ({ wallet: l.wallet.slice(0, 8) + "...", amount: l.amountAtomic.toString() })));
    return NextResponse.json({
      ok: true,
      claimable: false,
      reason: "no_allocation",
      epoch: epochRow.epoch,
    });
  }

  const epoch = BigInt(epochRow.epoch);

  // Compute PDAs
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], getProgramId());
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority"), configPda.toBuffer()],
    getProgramId()
  );
  const [epochRootPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("epoch_root"), u64LE(epoch)],
    getProgramId()
  );
  const [receiptPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), u64LE(epoch), claimerPk.toBuffer()],
    getProgramId()
  );

  // Check if already claimed on-chain
  const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");

  console.log("[claim/prepare] Checking on-chain receipt PDA:", receiptPda.toBase58());
  console.log("[claim/prepare] Using RPC:", rpc);

  const receiptInfo = await connection.getAccountInfo(receiptPda);

  console.log("[claim/prepare] Receipt account exists:", !!receiptInfo);
  if (receiptInfo) {
    console.log("[claim/prepare] Receipt owner:", receiptInfo.owner.toBase58());
    console.log("[claim/prepare] Program ID:", getProgramId().toBase58());
    console.log("[claim/prepare] Owner matches program:", receiptInfo.owner.equals(getProgramId()));
  }

  if (receiptInfo && receiptInfo.owner.equals(getProgramId())) {
    console.log("[claim/prepare] ALREADY CLAIMED - returning early");
    return NextResponse.json({
      ok: true,
      claimable: false,
      reason: "already_claimed",
      epoch: epoch.toString(),
      receipt: receiptPda.toBase58(),
    });
  }

  console.log("[claim/prepare] NOT claimed yet - proceeding with claim data");

  // Return claim data with proof
  return NextResponse.json({
    ok: true,
    claimable: true,
    epoch: epoch.toString(),
    amountAtomic: leaf.amountAtomic.toString(),
    index: leaf.index,
    proof: leaf.proofHex, // array of hex strings
    programId: getProgramId().toBase58(),
    xessMint: getXessMint().toBase58(),
    vaultAta: getVaultAta().toBase58(),
    claimer: claimerPk.toBase58(),
    pdas: {
      config: configPda.toBase58(),
      vaultAuthority: vaultAuthority.toBase58(),
      epochRoot: epochRootPda.toBase58(),
      receipt: receiptPda.toBase58(),
    },
  });
}
