/**
 * Auth-gated Prepare-Claim API
 *
 * Returns the user's claim proof data for a specific epoch.
 * Only the logged-in user can obtain their {proof, userKey, salt}.
 * Users can claim to ANY wallet because the wallet isn't part of the leaf anymore.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

function asInt(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    const sp = req.nextUrl.searchParams;
    const epoch = asInt(sp.get("epoch"));
    const weekKey = (sp.get("weekKey") || "").trim();

    if (epoch === null && !weekKey) {
      return NextResponse.json({ ok: false, error: "missing_epoch_or_weekKey" }, { status: 400 });
    }

    // Find epoch record
    const ce = await db.claimEpoch.findFirst({
      where: epoch !== null ? { epoch, version: 2 } : { weekKey, version: 2 },
      select: { epoch: true, weekKey: true, rootHex: true, setOnChain: true, version: true },
    });

    if (!ce) {
      return NextResponse.json({ ok: false, error: "epoch_not_found" }, { status: 404 });
    }

    // Only allow prepare once on-chain root is set
    if (!ce.setOnChain) {
      return NextResponse.json(
        { ok: false, error: "epoch_not_onchain_yet", epoch: ce.epoch, weekKey: ce.weekKey },
        { status: 409 }
      );
    }

    // Fetch the user's leaf for this epoch
    const leaf = await db.claimLeaf.findFirst({
      where: { epoch: ce.epoch, userId: user.id },
      select: {
        epoch: true,
        weekKey: true,
        userKeyHex: true,
        claimSaltHex: true,
        index: true,
        amountAtomic: true,
        proofHex: true,
      },
    });

    if (!leaf) {
      return NextResponse.json(
        { ok: false, error: "no_claim_for_user", epoch: ce.epoch, weekKey: ce.weekKey },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      version: ce.version ?? 2,
      epoch: leaf.epoch,
      weekKey: leaf.weekKey,
      rootHex: ce.rootHex,
      index: leaf.index,
      amountAtomic: leaf.amountAtomic.toString(),
      userKeyHex: leaf.userKeyHex,
      claimSaltHex: leaf.claimSaltHex,
      proofHex: leaf.proofHex,
    });
  } catch (err: any) {
    console.error("[claims/prepare] Error:", err);
    return NextResponse.json(
      { ok: false, error: "server_error", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
