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

interface ClaimableEpoch {
  epoch: string;
  weekKey: string;
  amountAtomic: string;
  index: number;
  proof: string[]; // hex strings
  pdas: {
    config: string;
    vaultAuthority: string;
    epochRoot: string;
    receipt: string;
  };
}

/**
 * GET /api/rewards/claim/all
 *
 * Returns all unclaimed epochs for the user with full claim data.
 * Each epoch needs a separate on-chain transaction due to merkle tree structure.
 */
export async function GET() {
  const ctx = await getAccessContext();
  if (!ctx.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const wallet = (ctx.user.solWallet || ctx.user.walletAddress || "").trim();
  if (!wallet) return NextResponse.json({ error: "no_wallet_linked" }, { status: 400 });

  const claimerPk = new PublicKey(wallet);
  const userId = ctx.user.id;

  // Get all on-chain epochs where user has a leaf
  const leaves = await db.claimLeaf.findMany({
    where: { wallet },
    include: {
      epochRel: {
        select: { epoch: true, weekKey: true, setOnChain: true },
      },
    },
    orderBy: { epoch: "asc" },
  });

  // Filter to only on-chain epochs
  const onChainLeaves = leaves.filter((l) => l.epochRel.setOnChain);

  if (onChainLeaves.length === 0) {
    return NextResponse.json({
      ok: true,
      claimableEpochs: [],
      totalClaimable: "0",
      message: "No claimable epochs found",
    });
  }

  // Check which are already claimed on-chain
  const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");

  const claimableEpochs: ClaimableEpoch[] = [];
  let totalClaimable = 0n;

  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], getProgramId());
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority"), configPda.toBuffer()],
    getProgramId()
  );

  for (const leaf of onChainLeaves) {
    const epoch = BigInt(leaf.epoch);

    const [epochRootPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("epoch_root"), u64LE(epoch)],
      getProgramId()
    );
    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), u64LE(epoch), claimerPk.toBuffer()],
      getProgramId()
    );

    // Check if already claimed on-chain
    const receiptInfo = await connection.getAccountInfo(receiptPda);
    if (receiptInfo && receiptInfo.owner.equals(getProgramId())) {
      // Already claimed - skip
      continue;
    }

    // Also check DB for claimed status
    const claimedReward = await db.rewardEvent.findFirst({
      where: {
        userId,
        weekKey: leaf.weekKey,
        claimedAt: { not: null },
      },
    });

    if (claimedReward) {
      // Already claimed in DB - skip
      continue;
    }

    // This epoch is claimable
    claimableEpochs.push({
      epoch: epoch.toString(),
      weekKey: leaf.weekKey,
      amountAtomic: leaf.amountAtomic.toString(),
      index: leaf.index,
      proof: leaf.proofHex as string[],
      pdas: {
        config: configPda.toBase58(),
        vaultAuthority: vaultAuthority.toBase58(),
        epochRoot: epochRootPda.toBase58(),
        receipt: receiptPda.toBase58(),
      },
    });

    totalClaimable += leaf.amountAtomic;
  }

  // Format total
  const DECIMALS = 1_000_000_000n;
  const whole = totalClaimable / DECIMALS;
  const frac = totalClaimable % DECIMALS;
  const formattedTotal =
    frac === 0n
      ? whole.toLocaleString()
      : `${whole.toLocaleString()}.${frac.toString().padStart(9, "0").replace(/0+$/, "")}`;

  return NextResponse.json({
    ok: true,
    claimableEpochs,
    totalClaimable: formattedTotal,
    totalClaimableAtomic: totalClaimable.toString(),
    programId: getProgramId().toBase58(),
    xessMint: getXessMint().toBase58(),
    vaultAta: getVaultAta().toBase58(),
    claimer: claimerPk.toBase58(),
  });
}
