import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Check admin access
  const access = await getAccessContext();
  if (!access.isAdminOrMod) {
    // Also check for admin API key header
    const key = req.headers.get("x-admin-key");
    if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60_000);

    // Group by IP and compute totals + last seen
    const grouped = await db.passwordResetAttempt.groupBy({
      by: ["ip"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _max: { createdAt: true },
    });

    // For denied counts, do a second groupBy
    const deniedGrouped = await db.passwordResetAttempt.groupBy({
      by: ["ip"],
      where: { createdAt: { gte: since }, allowed: false },
      _count: { _all: true },
    });

    const deniedMap = new Map<string, number>(
      deniedGrouped.map((r) => [r.ip, r._count._all])
    );

    const rows = grouped
      .map((r) => ({
        ip: r.ip,
        total: r._count._all,
        denied: deniedMap.get(r.ip) ?? 0,
        allowed: r._count._all - (deniedMap.get(r.ip) ?? 0),
        lastSeen: r._max.createdAt,
        // Abuse score: denied*3 + total
        abuseScore: (deniedMap.get(r.ip) ?? 0) * 3 + r._count._all,
      }))
      .sort((a, b) => b.abuseScore - a.abuseScore)
      .slice(0, 50);

    return NextResponse.json({ ok: true, since, rows });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { ok: false, error: error?.message ?? "ERR" },
      { status: 500 }
    );
  }
}
