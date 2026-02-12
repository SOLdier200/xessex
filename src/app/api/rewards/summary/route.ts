import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { ALL_REWARD_TYPES } from "@/lib/claimables";
import { fromHex32 } from "@/lib/merkleSha256";

export const runtime = "nodejs";

// Lazy-loaded to avoid build-time failures when env vars are not set
function getProgramId() {
  return new PublicKey(process.env.NEXT_PUBLIC_XESS_CLAIM_PROGRAM_ID!);
}

function u64LE(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

// Format atomic amount (9 decimals) to human-readable string
function formatAtomic(atomic: bigint): string {
  const DECIMALS = 1_000_000_000n;
  const whole = atomic / DECIMALS;
  const frac = atomic % DECIMALS;
  if (frac === 0n) return whole.toLocaleString();
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole.toLocaleString()}.${fracStr}`;
}

export async function GET() {
  const ctx = await getAccessContext();
  if (!ctx.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userId = ctx.user.id;
  const wallet = ctx.user.walletAddress || "".trim();
  const desiredVersion = 2; // V2 uses wallet-based rewards

  console.log("[rewards/summary] userId:", userId, "wallet:", wallet || "NONE");

  // Get the latest epoch that's set on-chain (claimable)
  const epoch = await db.claimEpoch.findFirst({
    where: { setOnChain: true, version: desiredVersion },
    orderBy: { epoch: "desc" },
  });

  console.log("[rewards/summary] Latest on-chain epoch:", epoch ? `#${epoch.epoch} (${epoch.weekKey})` : "NONE");

  if (!epoch) {
    return NextResponse.json({
      ok: true,
      epoch: null,
      pendingAmount: "0",
      hasPending: false,
      claim: null,
    });
  }

  // V2 only - find leaf by userId
  const leaf = await db.claimLeaf.findFirst({
    where: { epoch: epoch.epoch, userId: userId },
  });

  console.log("[rewards/summary] Leaf for wallet:", leaf ? `amount=${leaf.amountAtomic}` : "NOT FOUND");

  // Debug: show what wallets ARE in this epoch
  if (!leaf) {
    const allLeaves = await db.claimLeaf.findMany({ where: { epoch: epoch.epoch }, take: 5 });
    console.log("[rewards/summary] Sample leaves in epoch:", allLeaves.map(l => l.wallet?.slice(0, 12) ?? l.userKeyHex?.slice(0, 12) ?? "no-id"));
  }

  // Check if user has already claimed rewards
  // Check for ANY claimed rewards (not weekKey-specific, since test epochs aggregate all)
  const claimedRewards = await db.rewardEvent.findFirst({
    where: {
      userId,
      status: "PAID",
      claimedAt: { not: null },
      type: { in: ALL_REWARD_TYPES },
    },
  });

  // Also check for any unclaimed rewards
  const unclaimedRewards = await db.rewardEvent.findFirst({
    where: {
      userId,
      status: "PAID",
      claimedAt: null,
      type: { in: ALL_REWARD_TYPES },
    },
  });

  console.log("[rewards/summary] DB check - claimed:", claimedRewards ? "YES" : "NO", "unclaimed:", unclaimedRewards ? "YES" : "NO");

  // Also check on-chain receipt (in case DB wasn't updated after claim)
  let claimedOnChain = false;
  if (leaf?.userKeyHex && !claimedRewards) {
    try {
      const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
      const connection = new Connection(rpc, "confirmed");
      const epochBigInt = BigInt(epoch.epoch);

      const [receiptV2Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("receipt_v2"), u64LE(epochBigInt), fromHex32(leaf.userKeyHex)],
        getProgramId()
      );

      const receiptInfo = await connection.getAccountInfo(receiptV2Pda);
      if (receiptInfo && receiptInfo.owner.equals(getProgramId())) {
        claimedOnChain = true;
        console.log("[rewards/summary] On-chain receipt found for epoch", epoch.epoch, "- marking epoch rewards as claimed");

        // Sync DB: mark only THIS epoch's weekKey rewards as claimed
        await db.rewardEvent.updateMany({
          where: {
            userId,
            weekKey: epoch.weekKey,
            claimedAt: null,
            status: "PAID",
            type: { in: ALL_REWARD_TYPES },
          },
          data: { claimedAt: new Date(), txSig: "synced-from-onchain" },
        });
      }
    } catch (err) {
      console.error("[rewards/summary] Error checking on-chain receipt:", err);
    }
  }

  const pendingAmount = leaf?.amountAtomic ?? 0n;
  // alreadyClaimed = has claimed rewards AND no unclaimed rewards remaining
  const alreadyClaimed = (!!claimedRewards || claimedOnChain) && !unclaimedRewards;

  console.log("[rewards/summary] pendingAmount:", pendingAmount.toString(), "alreadyClaimed:", alreadyClaimed, "(db:", !!claimedRewards, "onchain:", claimedOnChain, "unclaimed:", !!unclaimedRewards, ") hasPending:", pendingAmount > 0n && !alreadyClaimed);

  // hasPending = has leaf in epoch AND has unclaimed rewards in DB
  const hasPending = pendingAmount > 0n && !!unclaimedRewards;

  return NextResponse.json({
    ok: true,
    epoch: { id: epoch.epoch, epochNo: epoch.epoch, merkleRoot: epoch.rootHex, version: 2 },
    pendingAmount: formatAtomic(pendingAmount),
    hasPending,
    claim: alreadyClaimed
      ? {
          id: claimedRewards?.id ?? `onchain-${epoch.epoch}`,
          status: "CLAIMED",
          txSig: null,
          error: null,
        }
      : null,
  });
}
