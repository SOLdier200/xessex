import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Parse tier from reason string like "Tier 5 AM accrual for 2026-02-10" */
function parseTierFromReason(reason: string): number {
  const m = reason.match(/Tier\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

/** Parse time slot (AM/PM) from reason string */
function parseTimeSlot(reason: string): string {
  if (/\bAM\b/.test(reason)) return "AM";
  if (/\bPM\b/.test(reason)) return "PM";
  return "AM";
}

/** Parse date from refId like "userId:2026-02-10:AM" */
function parseDateFromRefId(refId: string): string | null {
  const m = refId.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

type Entry = {
  id: string;
  time: string;
  amount: number;
  amountMicro: string;
  tier: number;
  createdAt: string;
};

type DayGroup = {
  date: string;
  entries: Entry[];
};

function groupByDate(
  rows: { id: string; amountMicro: bigint; reason: string; refId: string; createdAt: Date }[]
): DayGroup[] {
  const map = new Map<string, Entry[]>();

  for (const r of rows) {
    const date = parseDateFromRefId(r.refId) ?? r.createdAt.toISOString().slice(0, 10);
    const entry: Entry = {
      id: r.id,
      time: parseTimeSlot(r.reason),
      amount: Number(r.amountMicro) / Number(CREDIT_MICRO),
      amountMicro: r.amountMicro.toString(),
      tier: parseTierFromReason(r.reason),
      createdAt: r.createdAt.toISOString(),
    };
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(entry);
  }

  // Sort entries within each day: AM first, then PM
  for (const entries of map.values()) {
    entries.sort((a, b) => (a.time === "AM" && b.time === "PM" ? -1 : a.time === "PM" && b.time === "AM" ? 1 : 0));
  }

  // Sort days newest first
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, entries]) => ({ date, entries }));
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const month = url.searchParams.get("month"); // "YYYY-MM"

  // Always get available months for dropdown
  const allEntries = await db.specialCreditLedger.findMany({
    where: { userId: user.id, refType: "DAILY_ACCRUAL" },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const monthSet = new Set<string>();
  for (const e of allEntries) {
    const d = e.createdAt.toISOString().slice(0, 7); // "YYYY-MM"
    monthSet.add(d);
  }
  const months = Array.from(monthSet).sort((a, b) => b.localeCompare(a));

  if (month) {
    // Month mode: return all entries for the given month
    const startDate = new Date(`${month}-01T00:00:00Z`);
    const [y, m] = month.split("-").map(Number);
    const endDate = new Date(Date.UTC(y, m, 1)); // first day of next month

    const rows = await db.specialCreditLedger.findMany({
      where: {
        userId: user.id,
        refType: "DAILY_ACCRUAL",
        createdAt: { gte: startDate, lt: endDate },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      month,
      days: groupByDate(rows),
    });
  }

  // Recent mode: last 7 days of entries
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db.specialCreditLedger.findMany({
    where: {
      userId: user.id,
      refType: "DAILY_ACCRUAL",
      createdAt: { gte: sevenDaysAgo },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    recent: groupByDate(rows),
    months,
  });
}
