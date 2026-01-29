import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { Connection, PublicKey } from "@solana/web3.js";

export const runtime = "nodejs";

function bi(v: any): bigint {
  if (v === null || v === undefined) return 0n;
  if (typeof v === "bigint") return v;
  return BigInt(String(v));
}

function isCronRequest(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET || "";
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  return !!cronSecret && token === cronSecret;
}

function findReceiptV2Pda(epoch: bigint, claimerPubkey: PublicKey, programId: PublicKey): PublicKey {
  const epochBuf = Buffer.alloc(8);
  epochBuf.writeBigUInt64LE(epoch);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("receipt_v2"), epochBuf, claimerPubkey.toBuffer()],
    programId
  )[0];
}

function programIdFromEnv(): PublicKey {
  const pid =
    process.env.NEXT_PUBLIC_XESS_CLAIM_PROGRAM_ID ||
    process.env.XESS_CLAIM_PROGRAM_ID ||
    "";
  if (!pid) throw new Error("missing_program_id");
  return new PublicKey(pid);
}

function rpcFromEnv(): string {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.devnet.solana.com"
  );
}

export async function GET(req: NextRequest) {
  const access = await getAccessContext();
  const isCron = isCronRequest(req);
  if (!access.isAdminOrMod && !isCron) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const url = new URL(req.url);
  const verifyOnchain = url.searchParams.get("verifyOnchain") === "1";

  const legacyLeaves = await db.rewardEpochLeaf.findMany({
    select: {
      userId: true,
      epochId: true,
      amount: true,
      leafIndex: true,
      epoch: { select: { epochNo: true, startsAt: true, endsAt: true } },
    },
  });

  const legacyClaims = await db.rewardClaim.findMany({
    where: { status: "CLAIMED" },
    select: {
      userId: true,
      epochId: true,
      amount: true,
      txSig: true,
      claimedAt: true,
    },
  });

  const legacyClaimedMap = new Map<string, bigint>();
  const legacyClaimInfo = new Map<string, { txSig: string | null; claimedAt: Date | null }>();

  for (const c of legacyClaims) {
    const key = `${c.userId}:${c.epochId}`;
    legacyClaimedMap.set(key, bi(c.amount));
    legacyClaimInfo.set(key, { txSig: c.txSig ?? null, claimedAt: c.claimedAt ?? null });
  }

  const claimEpochsV2 = await db.claimEpoch.findMany({
    where: { version: 2 },
    select: { epoch: true, weekKey: true, rootHex: true, setOnChain: true, version: true },
    orderBy: { epoch: "desc" },
  });
  const claimEpochMap = new Map(claimEpochsV2.map((e) => [e.epoch, e]));

  const onchainLeavesAll = await db.claimLeaf.findMany({
    select: {
      userId: true,
      epoch: true,
      weekKey: true,
      amountAtomic: true,
      index: true,
      wallet: true,
      userKeyHex: true,
      claimSaltHex: true,
      createdAt: true,
    },
  });

  const onchainLeaves = onchainLeavesAll.filter((l) => claimEpochMap.has(l.epoch));

  const claimedKey = new Set<string>();

  if (verifyOnchain) {
    let programId: PublicKey;
    try {
      programId = programIdFromEnv();
    } catch {
      return NextResponse.json({ ok: false, error: "missing_program_id" }, { status: 500 });
    }

    const conn = new Connection(rpcFromEnv(), "confirmed");

    const pdas: PublicKey[] = [];
    const meta: Array<{ userId: string; epoch: number }> = [];

    for (const l of onchainLeaves) {
      const pubkey =
        l.wallet
          ? new PublicKey(l.wallet)
          : l.userKeyHex
          ? new PublicKey(Buffer.from(l.userKeyHex, "hex"))
          : null;

      if (!pubkey) continue;

      const pda = findReceiptV2Pda(BigInt(l.epoch), pubkey, programId);
      pdas.push(pda);
      meta.push({ userId: l.userId, epoch: l.epoch });
    }

    const CHUNK = 100;
    for (let i = 0; i < pdas.length; i += CHUNK) {
      const slice = pdas.slice(i, i + CHUNK);
      const infos = await conn.getMultipleAccountsInfo(slice);
      for (let j = 0; j < infos.length; j++) {
        if (infos[j]) {
          const m = meta[i + j];
          claimedKey.add(`${m.userId}:${m.epoch}`);
        }
      }
    }
  }

  type BreakdownRow = {
    system: "legacy" | "onchain";
    epochNo: number;
    epochId?: string | null;
    legacyLabel?: string | null;
    weekKey?: string | null;
    setOnChain?: boolean | null;
    claimableAtomic: string;
    claimedAtomic: string;
    unclaimedAtomic: string;
    status: string;
    txSig: string | null;
    claimedAt: string | null;
  };

  type UserAgg = {
    claimable: bigint;
    claimed: bigint;
    unclaimed: bigint;
    breakdown: BreakdownRow[];
  };

  const perUser = new Map<string, UserAgg>();

  for (const leaf of legacyLeaves) {
    const userId = leaf.userId;
    const epochId = leaf.epochId;
    const epochNo = leaf.epoch.epochNo;

    const claimable = bi(leaf.amount);
    const key = `${userId}:${epochId}`;
    const claimed = legacyClaimedMap.get(key) ?? 0n;
    const unclaimed = claimable - claimed;

    const info = legacyClaimInfo.get(key);
    const label =
      leaf.epoch.startsAt && leaf.epoch.endsAt
        ? `${leaf.epoch.startsAt.toISOString().slice(0, 10)} -> ${leaf.epoch.endsAt
            .toISOString()
            .slice(0, 10)}`
        : `epochNo ${epochNo}`;

    const agg = perUser.get(userId) ?? { claimable: 0n, claimed: 0n, unclaimed: 0n, breakdown: [] };
    agg.claimable += claimable;
    agg.claimed += claimed;
    agg.unclaimed += unclaimed;

    agg.breakdown.push({
      system: "legacy",
      epochNo,
      epochId,
      legacyLabel: label,
      claimableAtomic: claimable.toString(),
      claimedAtomic: claimed.toString(),
      unclaimedAtomic: unclaimed.toString(),
      status: claimed > 0n ? "CLAIMED" : "UNCLAIMED",
      txSig: info?.txSig ?? null,
      claimedAt: info?.claimedAt ? info.claimedAt.toISOString() : null,
    });

    perUser.set(userId, agg);
  }

  for (const leaf of onchainLeaves) {
    if (!leaf.userKeyHex || !leaf.claimSaltHex) continue;

    const userId = leaf.userId;
    const epochNo = leaf.epoch;
    const claimable = bi(leaf.amountAtomic);
    if (claimable <= 0n) continue;

    const ce = claimEpochMap.get(epochNo);
    const setOnChain = ce?.setOnChain ?? null;

    const isClaimed = verifyOnchain ? claimedKey.has(`${userId}:${epochNo}`) : false;
    const claimed = verifyOnchain ? (isClaimed ? claimable : 0n) : 0n;
    const unclaimed = verifyOnchain ? (isClaimed ? 0n : claimable) : claimable;

    const agg = perUser.get(userId) ?? { claimable: 0n, claimed: 0n, unclaimed: 0n, breakdown: [] };
    agg.claimable += claimable;
    agg.claimed += claimed;
    agg.unclaimed += unclaimed;

    agg.breakdown.push({
      system: "onchain",
      epochNo,
      weekKey: leaf.weekKey,
      setOnChain,
      claimableAtomic: claimable.toString(),
      claimedAtomic: claimed.toString(),
      unclaimedAtomic: unclaimed.toString(),
      status: verifyOnchain
        ? isClaimed
          ? "CLAIMED (receipt_v2 exists)"
          : "UNCLAIMED (no receipt_v2)"
        : setOnChain === false
        ? "PENDING (epoch not on-chain yet)"
        : "UNKNOWN (no receipt check)",
      txSig: null,
      claimedAt: null,
    });

    perUser.set(userId, agg);
  }

  const userIds = [...perUser.keys()];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, role: true, solWallet: true, walletAddress: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows = [...perUser.entries()]
    .filter(([, agg]) => agg.unclaimed > 0n)
    .map(([userId, agg]) => {
      const u = userMap.get(userId);
      return {
        userId,
        email: u?.email ?? null,
        role: u?.role ?? null,
        solWallet: u?.solWallet ?? null,
        walletAddress: u?.walletAddress ?? null,
        claimableAtomic: agg.claimable.toString(),
        claimedAtomic: agg.claimed.toString(),
        unclaimedAtomic: agg.unclaimed.toString(),
        breakdown: agg.breakdown.sort((a, b) => b.epochNo - a.epochNo),
      };
    })
    .sort((a, b) => (BigInt(b.unclaimedAtomic) > BigInt(a.unclaimedAtomic) ? 1 : -1));

  return NextResponse.json({ ok: true, verifyOnchain, count: rows.length, rows });
}
