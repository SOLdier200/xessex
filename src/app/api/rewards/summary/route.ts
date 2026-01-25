import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

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
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userId = user.id;
  const wallet = (user.solWallet || user.walletAddress || "").trim();

  console.log("[rewards/summary] userId:", userId, "wallet:", wallet || "NONE");

  // Get the latest epoch that's set on-chain (claimable)
  const epoch = await db.claimEpoch.findFirst({
    where: { setOnChain: true },
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

  // Get user's leaf for this epoch (by wallet)
  const leaf = wallet
    ? await db.claimLeaf.findUnique({
        where: { epoch_wallet: { epoch: epoch.epoch, wallet } },
      })
    : null;

  console.log("[rewards/summary] Leaf for wallet:", leaf ? `amount=${leaf.amountAtomic}` : "NOT FOUND");

  // Debug: show what wallets ARE in this epoch
  if (!leaf) {
    const allLeaves = await db.claimLeaf.findMany({ where: { epoch: epoch.epoch }, take: 5 });
    console.log("[rewards/summary] Sample leaves in epoch:", allLeaves.map(l => l.wallet?.slice(0, 12) ?? l.userKeyHex?.slice(0, 12) ?? "no-id"));
  }

  // Check if user has already claimed this epoch's rewards
  // We check RewardEvent.claimedAt for the weekKey
  const claimedRewards = await db.rewardEvent.findFirst({
    where: {
      userId,
      weekKey: epoch.weekKey,
      status: "PAID",
      claimedAt: { not: null },
    },
  });

  console.log("[rewards/summary] Claimed check for weekKey", epoch.weekKey, "found:", claimedRewards ? `id=${claimedRewards.id}, claimedAt=${claimedRewards.claimedAt}` : "NONE");

  const pendingAmount = leaf?.amountAtomic ?? 0n;
  const alreadyClaimed = !!claimedRewards;

  console.log("[rewards/summary] pendingAmount:", pendingAmount.toString(), "alreadyClaimed:", alreadyClaimed, "hasPending:", pendingAmount > 0n && !alreadyClaimed);

  // hasPending = has leaf amount AND not already claimed
  const hasPending = pendingAmount > 0n && !alreadyClaimed;

  return NextResponse.json({
    ok: true,
    epoch: { id: epoch.epoch, epochNo: epoch.epoch, merkleRoot: epoch.rootHex },
    pendingAmount: formatAtomic(pendingAmount),
    hasPending,
    claim: alreadyClaimed
      ? {
          id: claimedRewards!.id,
          status: "CLAIMED",
          txSig: null, // TODO: store txSig on RewardEvent when claim completes
          error: null,
        }
      : null,
  });
}
