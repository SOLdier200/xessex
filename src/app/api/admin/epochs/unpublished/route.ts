import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  return token === secret;
}

export async function GET(req: NextRequest) {
  const ctx = await getAccessContext();
  const isAdmin = !!ctx.isAdminOrMod;
  const isCron = cronAuthorized(req);

  if (!isAdmin && !isCron) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const epochs = await db.claimEpoch.findMany({
    where: { setOnChain: false },
    orderBy: { epoch: "asc" },
    select: {
      epoch: true,
      weekKey: true,
      rootHex: true,
      version: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    epochs: epochs.map((e) => ({
      epoch: e.epoch,
      weekKey: e.weekKey,
      rootHex: e.rootHex,
      version: e.version ?? 1,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
