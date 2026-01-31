import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

const REF_TYPES: Array<"REF_L1" | "REF_L2" | "REF_L3"> = ["REF_L1", "REF_L2", "REF_L3"];

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 2)}***@${domain}`;
}

function truncateWallet(address: string | null): string | null {
  if (!address) return null;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function displayLabel(user: { id: string; email: string | null; walletAddress: string | null }) {
  return (
    maskEmail(user.email) ||
    truncateWallet(user.walletAddress) ||
    `${user.id.slice(0, 8)}...`
  );
}

function format6(amount: bigint): string {
  const DECIMALS = 1_000_000n;
  const whole = amount / DECIMALS;
  const frac = amount % DECIMALS;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // L1 referrals
  const l1 = await db.user.findMany({
    where: { referredById: user.id },
    select: { id: true, email: true, walletAddress: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const l1Ids = l1.map((u) => u.id);

  // L2 referrals
  const l2 = l1Ids.length
    ? await db.user.findMany({
        where: { referredById: { in: l1Ids } },
        select: { id: true, email: true, walletAddress: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const l2Ids = l2.map((u) => u.id);

  // L3 referrals
  const l3 = l2Ids.length
    ? await db.user.findMany({
        where: { referredById: { in: l2Ids } },
        select: { id: true, email: true, walletAddress: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Per-referral earnings (only events with referralFromUserId set)
  const perReferral = await db.rewardEvent.groupBy({
    by: ["referralFromUserId", "type"],
    where: {
      userId: user.id,
      status: "PAID",
      type: { in: REF_TYPES },
      referralFromUserId: { not: null },
    },
    _sum: { amount: true },
  });

  const earnedMap = new Map<string, bigint>();
  for (const row of perReferral) {
    const key = `${row.type}:${row.referralFromUserId}`;
    const amount = BigInt((row._sum.amount as bigint) ?? 0n);
    earnedMap.set(key, amount);
  }

  // Totals per level
  const totals = await db.rewardEvent.groupBy({
    by: ["type"],
    where: {
      userId: user.id,
      status: "PAID",
      type: { in: REF_TYPES },
    },
    _sum: { amount: true },
  });

  const totalByType = new Map<string, bigint>();
  for (const row of totals) {
    totalByType.set(row.type, BigInt((row._sum.amount as bigint) ?? 0n));
  }

  // Unattributed (old data without referralFromUserId)
  const unattributed = await db.rewardEvent.groupBy({
    by: ["type"],
    where: {
      userId: user.id,
      status: "PAID",
      type: { in: REF_TYPES },
      referralFromUserId: null,
    },
    _sum: { amount: true },
  });
  const unattributedByType = new Map<string, bigint>();
  for (const row of unattributed) {
    unattributedByType.set(row.type, BigInt((row._sum.amount as bigint) ?? 0n));
  }

  function mapLevel(level: "REF_L1" | "REF_L2" | "REF_L3", list: typeof l1) {
    return list.map((u) => {
      const earned = earnedMap.get(`${level}:${u.id}`) || 0n;
      return {
        id: u.id,
        label: displayLabel(u),
        wallet: u.walletAddress || null,
        createdAt: u.createdAt.toISOString(),
        earnedAtomic: earned.toString(),
        earned: format6(earned),
      };
    });
  }

  const l1List = mapLevel("REF_L1", l1);
  const l2List = mapLevel("REF_L2", l2);
  const l3List = mapLevel("REF_L3", l3);

  const t1 = totalByType.get("REF_L1") || 0n;
  const t2 = totalByType.get("REF_L2") || 0n;
  const t3 = totalByType.get("REF_L3") || 0n;
  const totalAll = t1 + t2 + t3;

  return NextResponse.json({
    ok: true,
    levels: {
      L1: l1List,
      L2: l2List,
      L3: l3List,
    },
    totals: {
      L1: format6(t1),
      L2: format6(t2),
      L3: format6(t3),
      total: format6(totalAll),
      L1Atomic: t1.toString(),
      L2Atomic: t2.toString(),
      L3Atomic: t3.toString(),
      totalAtomic: totalAll.toString(),
    },
    unattributed: {
      L1: format6(unattributedByType.get("REF_L1") || 0n),
      L2: format6(unattributedByType.get("REF_L2") || 0n),
      L3: format6(unattributedByType.get("REF_L3") || 0n),
    },
  });
}
