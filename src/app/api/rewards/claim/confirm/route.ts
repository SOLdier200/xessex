import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";
import { fromHex32 } from "@/lib/merkleSha256";
import { ALL_REWARD_TYPES } from "@/lib/claimables";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

// Lazy-loaded to avoid build-time failures when env vars are not set
function getProgramId() {
  return new PublicKey(process.env.NEXT_PUBLIC_XESS_CLAIM_PROGRAM_ID!);
}
function getXessMint() {
  return new PublicKey(process.env.XESS_MINT!);
}
function getVaultAta() {
  return new PublicKey(process.env.XESS_VAULT_ATA!);
}

function u64LE(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const signature: string | undefined = body.signature;
  const epochStr: string | undefined = body.epoch;
  const version: number = body.version ?? 1;
  const userKeyHex: string | undefined = body.userKeyHex; // V2 only
  const claimerWallet: string | undefined = body.claimer; // V2: wallet that received tokens

  // ── Input validation ─────────────────────────────────────────
  if (!signature || typeof signature !== "string") {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const epoch = Number(epochStr);
  if (!Number.isFinite(epoch)) {
    return NextResponse.json({ error: "missing_or_invalid_epoch" }, { status: 400 });
  }

  // ========== TESTING MODE (bypasses DB entirely) ==========
  const testMode = process.env.XESS_CLAIM_TESTMODE === "1";
  const TEST_CLAIMER = "J1ssN9Fr6qeNN1CUphVV8XaaPbx2YHpt1gv9SLupJTMe";

  if (testMode) {
    const claimerPk = new PublicKey(TEST_CLAIMER);
    const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpc, "confirmed");

    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), u64LE(BigInt(epoch)), claimerPk.toBuffer()],
      getProgramId()
    );

    const receiptInfo = await connection.getAccountInfo(receiptPda, "confirmed");
    if (!receiptInfo) {
      return NextResponse.json({ error: "receipt_missing" }, { status: 400 });
    }

    const userAta = getAssociatedTokenAddressSync(getXessMint(), claimerPk);

    return NextResponse.json({
      ok: true,
      testMode: true,
      receipt: receiptPda.toBase58(),
      userAta: userAta.toBase58(),
      signature,
      epoch,
    });
  }
  // ========== END TESTING MODE ==========

  // ========== PRODUCTION MODE ==========
  if (version !== 2) {
    return NextResponse.json({ error: "v1_not_supported", message: "V1 claims are no longer supported. Use V2." }, { status: 400 });
  }

  const ctx = await getAccessContext();
  if (!ctx.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Check claim freeze
  if (ctx.user.claimFrozen) {
    if (ctx.user.claimFrozenUntil && ctx.user.claimFrozenUntil < new Date()) {
      db.user.update({ where: { id: ctx.user.id }, data: { claimFrozen: false, claimFrozenUntil: null } }).catch(() => {});
    } else {
      return NextResponse.json({ error: "claim_frozen" }, { status: 403 });
    }
  }

  if (!userKeyHex) return NextResponse.json({ error: "missing_user_key_hex" }, { status: 400 });
  if (!claimerWallet) return NextResponse.json({ error: "missing_claimer" }, { status: 400 });

  // ── Leaf lookup (unique constraint: epoch + userId) ──────────
  const leaf = await db.claimLeaf.findUnique({
    where: { epoch_userId: { epoch, userId: ctx.user.id } },
  });

  if (!leaf) {
    return NextResponse.json({ error: "claim_leaf_not_found", epoch }, { status: 404 });
  }

  const weekKey = leaf.weekKey;

  // ── Idempotency: if this period is already claimed, return ok ─
  const alreadyClaimed = await db.rewardEvent.findFirst({
    where: {
      userId: ctx.user.id,
      weekKey,
      status: "PAID",
      claimedAt: { not: null },
      type: { in: ALL_REWARD_TYPES },
    },
    select: { txSig: true, claimedAt: true },
  });

  if (alreadyClaimed) {
    return NextResponse.json({
      ok: true,
      already: true,
      weekKey,
      txSig: alreadyClaimed.txSig,
      claimedAt: alreadyClaimed.claimedAt,
    });
  }

  // ── Mark claimed (scoped to weekKey) ─────────────────────────
  async function markClaimedInDbV2(txSig: string) {
    const updated = await db.rewardEvent.updateMany({
      where: {
        userId: ctx.user!.id,
        weekKey,
        claimedAt: null,
        status: "PAID",
        type: { in: ALL_REWARD_TYPES },
      },
      data: { claimedAt: new Date(), txSig },
    });

    console.log(`[claim/confirm] Marked ${updated.count} rewards as claimed for user ${ctx.user!.id} weekKey=${weekKey}`);

    if (updated.count === 0) {
      const syntheticRefId = `claim-v2-${ctx.user!.id}-${weekKey}`;
      // Convert from 9 decimals (on-chain atomic) to 6 decimals (RewardEvent.amount)
      const amountAtomic6 = leaf.amountAtomic / 1_000n;
      await db.rewardEvent.upsert({
        where: {
          refType_refId: {
            refType: "CLAIM_V2",
            refId: syntheticRefId,
          },
        },
        create: {
          userId: ctx.user!.id,
          weekKey,
          type: "WEEKLY_LIKES",
          amount: amountAtomic6,
          status: "PAID",
          refType: "CLAIM_V2",
          refId: syntheticRefId,
          claimedAt: new Date(),
          txSig,
        },
        update: {
          claimedAt: new Date(),
          txSig,
        },
      });
    }
  }

  const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");

  const userKeyBytes = fromHex32(userKeyHex);
  const claimerPk = new PublicKey(claimerWallet);

  // V2 Receipt PDA
  const [receiptV2Pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("receipt_v2"), u64LE(BigInt(epoch)), userKeyBytes],
    getProgramId()
  );

  // IDEMPOTENT: If receipt already exists on-chain, mark DB and return success
  const receiptInfo = await connection.getAccountInfo(receiptV2Pda, "confirmed");
  if (receiptInfo && receiptInfo.owner.equals(getProgramId())) {
    await markClaimedInDbV2(signature);

    const userAta = getAssociatedTokenAddressSync(getXessMint(), claimerPk);
    return NextResponse.json({
      ok: true,
      version: 2,
      alreadyClaimed: true,
      weekKey,
      receiptV2: receiptV2Pda.toBase58(),
      userAta: userAta.toBase58(),
    });
  }

  // Verify the transaction
  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) return NextResponse.json({ error: "tx_not_found" }, { status: 404 });
  if (tx.meta?.err) return NextResponse.json({ error: "tx_failed", metaErr: tx.meta.err }, { status: 400 });

  const msg = tx.transaction.message;
  const keys = msg.getAccountKeys().staticAccountKeys;

  if (!keys.some((k) => k.equals(getProgramId()))) {
    return NextResponse.json({ error: "wrong_program" }, { status: 400 });
  }

  // Re-check receipt after tx verification
  const receiptInfoAfter = await connection.getAccountInfo(receiptV2Pda, "confirmed");
  if (!receiptInfoAfter) return NextResponse.json({ error: "receipt_missing" }, { status: 400 });
  if (!receiptInfoAfter.owner.equals(getProgramId())) {
    return NextResponse.json({ error: "receipt_wrong_owner" }, { status: 400 });
  }

  const expected = leaf.amountAtomic;
  const userAta = getAssociatedTokenAddressSync(getXessMint(), claimerPk);

  const inner = tx.meta?.innerInstructions ?? [];
  let transferred = 0n;

  for (const group of inner) {
    for (const ix of group.instructions) {
      const prog = keys[ix.programIdIndex];
      if (!prog?.equals(TOKEN_PROGRAM_ID)) continue;

      const data = Buffer.from(ix.data, "base64");
      if (data.length < 9) continue;
      if (data[0] !== 3) continue;

      const amount = data.readBigUInt64LE(1);

      const acctIdx = ix.accounts;
      if (acctIdx.length < 2) continue;

      const src = keys[acctIdx[0]];
      const dst = keys[acctIdx[1]];

      if (src?.equals(getVaultAta()) && dst?.equals(userAta)) {
        transferred += amount;
      }
    }
  }

  if (transferred < expected) {
    return NextResponse.json(
      { error: "transfer_too_small", expected: expected.toString(), transferred: transferred.toString() },
      { status: 400 }
    );
  }

  await markClaimedInDbV2(signature);

  return NextResponse.json({
    ok: true,
    version: 2,
    weekKey,
    receiptV2: receiptV2Pda.toBase58(),
    userAta: userAta.toBase58(),
    transferred: transferred.toString(),
  });
}
