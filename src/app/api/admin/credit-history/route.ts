import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

/**
 * GET /api/admin/credit-history
 *
 * Returns all DAILY_ACCRUAL ledger entries grouped by accrual run (refId slot).
 * Query params:
 *   ?page=1        (1-indexed, default 1)
 *   ?perPage=50    (default 50)
 *   ?userId=xxx    (optional filter by user)
 *   ?dateKey=xxx   (optional filter by date, e.g. "2026-02-13")
 */
export async function GET(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.user)
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (!access.isAdminOrMod)
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const url = req.nextUrl;
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("perPage") || "50")));
  const userIdFilter = url.searchParams.get("userId") || undefined;
  const dateKeyFilter = url.searchParams.get("dateKey") || undefined;

  try {
    // Build where clause
    const where: Record<string, unknown> = { refType: "DAILY_ACCRUAL" };
    if (userIdFilter) where.userId = userIdFilter;
    if (dateKeyFilter) {
      // refId format: "userId:dateKey:AM|PM"
      where.refId = { contains: `:${dateKeyFilter}:` };
    }

    const [entries, total] = await Promise.all([
      db.specialCreditLedger.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              walletAddress: true,
            },
          },
        },
      }),
      db.specialCreditLedger.count({ where }),
    ]);

    // Get distinct accrual runs grouped by date+slot (extracted from refId "userId:date:slot")
    const rawRuns: Array<{ run_key: string; user_count: bigint; total_micro: bigint }> =
      await db.$queryRaw`
        SELECT
          REGEXP_REPLACE("refId", '^[^:]+:', '') as run_key,
          COUNT(DISTINCT "userId")::bigint as user_count,
          COALESCE(SUM("amountMicro"), 0)::bigint as total_micro
        FROM "SpecialCreditLedger"
        WHERE "refType" = 'DAILY_ACCRUAL'
        GROUP BY run_key
        ORDER BY run_key DESC
        LIMIT 200
      `;

    // Serialize BigInt fields
    const serialized = entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      user: e.user,
      amountMicro: e.amountMicro.toString(),
      reason: e.reason,
      refType: e.refType,
      refId: e.refId,
      weekKey: e.weekKey,
      createdAt: e.createdAt.toISOString(),
    }));

    const runsSerialized = rawRuns.map((r) => {
      const parts = r.run_key.split(":");
      return {
        date: parts[0] || "",
        slot: parts[1] || "",
        count: Number(r.user_count),
        totalMicro: r.total_micro.toString(),
      };
    });

    return NextResponse.json({
      ok: true,
      entries: serialized,
      runs: runsSerialized,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error("[CREDIT_HISTORY] GET error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
