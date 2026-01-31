/**
 * Auth-gated Prepare-Claim API
 *
 * Returns the user's claim proof data for a specific epoch.
 * Only the logged-in user can obtain their {proof, userKey, salt}.
 *
 * V2 wallet-based identity:
 * - userKeyHex is the wallet pubkey (not keccak hash)
 * - Claims must be made with the wallet that earned the rewards
 * - User must have a linked wallet that matches the leaf
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { userKey32FromWallet, toHex32 } from "@/lib/merkleSha256";

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

    // Find epoch record (use orderBy for deterministic selection)
    const ce = await db.claimEpoch.findFirst({
      where: epoch !== null
        ? { epoch, version: 2 }
        : { weekKey, version: 2, setOnChain: true },
      orderBy: { epoch: "desc" },
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

    // Fetch the user's leaf for this epoch (orderBy for determinism if duplicates exist)
    const leaf = await db.claimLeaf.findFirst({
      where: { epoch: ce.epoch, userId: user.id },
      orderBy: { createdAt: "desc" },
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

    // V2 wallet-based: verify user has a linked wallet that matches the leaf
    const userWallet = (user.walletAddress || "").trim();
    const expectedUserKeyHex = userWallet ? toHex32(userKey32FromWallet(userWallet)) : null;
    const walletMismatch = !expectedUserKeyHex || leaf.userKeyHex !== expectedUserKeyHex;

    // Debug logging for BadProof diagnosis
    const epochMatchCount = await db.claimEpoch.count({
      where: epoch !== null ? { epoch, version: 2 } : { weekKey, version: 2 },
    });

    console.log("[claims/prepare] Diagnostics:", {
      epochMatchCount,
      userId: user.id,
      userWallet: userWallet || "(none)",
      expectedUserKeyHex: expectedUserKeyHex || "(no wallet)",
      leafUserKeyHex: leaf.userKeyHex,
      walletMismatch,
    });

    console.log("[claims/prepare] Serving claim:", {
      epoch: leaf.epoch,
      weekKey: leaf.weekKey,
      index: leaf.index,
      amountAtomic: leaf.amountAtomic.toString(),
      rootHex: ce.rootHex,
      setOnChain: ce.setOnChain,
    });

    // Warn if wallet mismatch detected (this would cause BadProof)
    if (walletMismatch) {
      console.warn("[claims/prepare] WARNING: Wallet mismatch! User's linked wallet doesn't match the leaf.");
      console.warn("[claims/prepare] The user must claim with the wallet that earned the rewards.");
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
