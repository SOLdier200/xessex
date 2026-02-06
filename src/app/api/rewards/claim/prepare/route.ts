import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";
import { fromHex32 } from "@/lib/merkleSha256";

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

  // Check claim freeze
  if (ctx.user.claimFrozen) {
    if (ctx.user.claimFrozenUntil && ctx.user.claimFrozenUntil < new Date()) {
      // Expired freeze — auto-lift
      db.user.update({ where: { id: ctx.user.id }, data: { claimFrozen: false, claimFrozenUntil: null } }).catch(() => {});
    } else {
      return NextResponse.json({ ok: true, claimable: false, reason: "claim_frozen" });
    }
  }

  const desiredVersion = 2; // V2 uses wallet-based rewards

  // Get the latest epoch with a root set on-chain (by version)
  const epochRow = await db.claimEpoch.findFirst({
    where: { setOnChain: true, version: desiredVersion },
    orderBy: { epoch: "desc" },
  });

  console.log("[claim/prepare] User:", ctx.user.id);
  console.log("[claim/prepare] Latest on-chain epoch:", epochRow ? `#${epochRow.epoch} (weekKey: ${epochRow.weekKey}, version: ${epochRow.version})` : "NONE");

  if (!epochRow) {
    const allEpochs = await db.claimEpoch.findMany({ orderBy: { epoch: "desc" }, take: 5 });
    console.log("[claim/prepare] All epochs:", allEpochs.map(e => ({ epoch: e.epoch, weekKey: e.weekKey, setOnChain: e.setOnChain, version: e.version })));
    return NextResponse.json({
      ok: true,
      claimable: false,
      reason: "no_epoch",
    });
  }

  const epoch = BigInt(epochRow.epoch);

  // V2 only - require version 2 epoch
  if (epochRow.version !== 2) {
    return NextResponse.json({
      ok: true,
      claimable: false,
      reason: "legacy_epoch",
      version: epochRow.version,
      epoch: epochRow.epoch,
      message: "This epoch uses legacy V1 format which is no longer supported.",
    });
  }

  // V2 epoch: wallet-based identity (userKeyHex is wallet pubkey bytes)
  {
    // V2 requires a linked wallet
    const wallet = ctx.user.walletAddress || "".trim();
    if (!wallet) {
      return NextResponse.json({
        ok: true,
        claimable: false,
        reason: "no_wallet_linked",
        version: 2,
        epoch: epochRow.epoch,
        message: "V2 claims require a linked wallet. Please link your wallet first.",
      });
    }

    const claimerPk = new PublicKey(wallet);

    // Get user's leaf by userId
    const leaf = await db.claimLeaf.findFirst({
      where: { epoch: epochRow.epoch, userId: ctx.user.id },
    });

    console.log("[claim/prepare] V2 Leaf for user:", leaf ? `index=${leaf.index}, amount=${leaf.amountAtomic}` : "NOT FOUND");

    if (!leaf || !leaf.userKeyHex || !leaf.claimSaltHex) {
      return NextResponse.json({
        ok: true,
        claimable: false,
        reason: "no_allocation",
        version: 2,
        epoch: epochRow.epoch,
      });
    }

    // Verify user's current wallet matches the leaf's wallet
    const leafWalletHex = leaf.userKeyHex;
    const currentWalletHex = claimerPk.toBuffer().toString("hex");
    if (leafWalletHex !== currentWalletHex) {
      console.warn("[claim/prepare] V2 Wallet mismatch!", {
        leafWalletHex: leafWalletHex.slice(0, 16) + "...",
        currentWalletHex: currentWalletHex.slice(0, 16) + "...",
      });
      return NextResponse.json({
        ok: true,
        claimable: false,
        reason: "wallet_mismatch",
        version: 2,
        epoch: epochRow.epoch,
        message: "Your current wallet doesn't match the wallet that earned these rewards.",
      });
    }

    // Compute PDAs for V2
    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], getProgramId());
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_authority"), configPda.toBuffer()],
      getProgramId()
    );
    const [epochRootPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("epoch_root"), u64LE(epoch)],
      getProgramId()
    );

    // V2 receipt PDA uses claimer pubkey (not keccak hash of userId)
    const [receiptV2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt_v2"), u64LE(epoch), claimerPk.toBuffer()],
      getProgramId()
    );

    // Check if already claimed on-chain
    const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpc, "confirmed");

    console.log("[claim/prepare] V2 Checking receipt PDA:", receiptV2Pda.toBase58());

    const receiptInfo = await connection.getAccountInfo(receiptV2Pda);

    if (receiptInfo && receiptInfo.owner.equals(getProgramId())) {
      console.log("[claim/prepare] V2 ALREADY CLAIMED");
      return NextResponse.json({
        ok: true,
        claimable: false,
        reason: "already_claimed",
        version: 2,
        epoch: epoch.toString(),
        receiptV2: receiptV2Pda.toBase58(),
      });
    }

    console.log("[claim/prepare] V2 NOT claimed yet - returning claim data");

    // Return V2 claim data (no wallet in response - user connects wallet at claim time)
    return NextResponse.json({
      ok: true,
      claimable: true,
      version: 2,
      epoch: epoch.toString(),
      amountAtomic: leaf.amountAtomic.toString(),
      index: leaf.index,
      userKeyHex: leaf.userKeyHex,
      claimSaltHex: leaf.claimSaltHex,
      proof: leaf.proofHex,
      programId: getProgramId().toBase58(),
      xessMint: getXessMint().toBase58(),
      vaultAta: getVaultAta().toBase58(),
      pdas: {
        config: configPda.toBase58(),
        vaultAuthority: vaultAuthority.toBase58(),
        epochRoot: epochRootPda.toBase58(),
        receiptV2: receiptV2Pda.toBase58(),
      },
    });
  }
}
