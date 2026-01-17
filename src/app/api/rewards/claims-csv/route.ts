import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

function csvEscape(v: string) {
  if (v.includes('"') || v.includes(",") || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userId = user.id;

  const claims = await db.rewardClaim.findMany({
    where: { userId },
    include: { epoch: true },
    orderBy: { startedAt: "desc" },
  });

  const header = ["startedAt", "epochNo", "amount", "status", "txSig"];
  const rows = claims.map((c) => [
    c.startedAt.toISOString(),
    String(c.epoch.epochNo),
    c.amount.toString(),
    c.status,
    c.txSig ?? "",
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="xess-claims.csv"`,
    },
  });
}
