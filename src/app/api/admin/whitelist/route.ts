/**
 * Admin Whitelist Management API
 *
 * GET    /api/admin/whitelist          - List all whitelisted wallets
 * POST   /api/admin/whitelist          - Add wallet(s) to whitelist
 * DELETE /api/admin/whitelist?wallet=X - Remove wallet from whitelist
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

const noCache = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
};

export async function GET() {
  const ctx = await getAccessContext();
  if (!ctx.isAdminOrMod) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403, headers: noCache }
    );
  }

  try {
    const wallets = await db.saleWhitelist.findMany({
      orderBy: { addedAt: "desc" },
    });

    return NextResponse.json(
      {
        ok: true,
        wallets: wallets.map((w) => ({
          id: w.id,
          wallet: w.wallet,
          note: w.note,
          addedBy: w.addedBy,
          addedAt: w.addedAt.toISOString(),
        })),
        count: wallets.length,
      },
      { headers: noCache }
    );
  } catch (err) {
    console.error("Admin whitelist GET error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500, headers: noCache }
    );
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getAccessContext();
  if (ctx.user?.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403, headers: noCache }
    );
  }

  try {
    const body = await req.json();

    // Accept single wallet string or array of wallets
    const rawWallets: string[] = Array.isArray(body.wallets)
      ? body.wallets
      : body.wallet
      ? [body.wallet]
      : [];

    const note = body.note || null;
    const addedBy =
      ctx.user.walletAddress || ctx.user.email || ctx.user.id;

    // Clean and validate
    const cleaned = rawWallets
      .map((w: string) => w.trim().toLowerCase())
      .filter((w: string) => w.length >= 32 && w.length <= 44);

    if (cleaned.length === 0) {
      return NextResponse.json(
        { ok: false, error: "no_valid_wallets" },
        { status: 400, headers: noCache }
      );
    }

    // Upsert each wallet (skipDuplicates)
    let added = 0;
    let skipped = 0;

    for (const wallet of cleaned) {
      try {
        await db.saleWhitelist.create({
          data: { wallet, note, addedBy },
        });
        added++;
      } catch (e: unknown) {
        // Unique constraint violation = already exists
        if (
          e &&
          typeof e === "object" &&
          "code" in e &&
          (e as { code: string }).code === "P2002"
        ) {
          skipped++;
        } else {
          throw e;
        }
      }
    }

    return NextResponse.json(
      { ok: true, added, skipped, total: added + skipped },
      { headers: noCache }
    );
  } catch (err) {
    console.error("Admin whitelist POST error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500, headers: noCache }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAccessContext();
  if (ctx.user?.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403, headers: noCache }
    );
  }

  try {
    const wallet = req.nextUrl.searchParams
      .get("wallet")
      ?.trim()
      .toLowerCase();

    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: "missing_wallet" },
        { status: 400, headers: noCache }
      );
    }

    await db.saleWhitelist.deleteMany({ where: { wallet } });

    return NextResponse.json({ ok: true }, { headers: noCache });
  } catch (err) {
    console.error("Admin whitelist DELETE error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500, headers: noCache }
    );
  }
}
