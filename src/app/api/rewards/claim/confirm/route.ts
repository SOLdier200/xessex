import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";
import { fromHex32 } from "@/lib/merkleSha256";

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

  if (!signature) return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  if (!epochStr) return NextResponse.json({ error: "missing_epoch" }, { status: 400 });

  const epoch = BigInt(epochStr);

  // ========== TESTING MODE (bypasses DB entirely) ==========
  const testMode = process.env.XESS_CLAIM_TESTMODE === "1";
  const TEST_CLAIMER = "J1ssN9Fr6qeNN1CUphVV8XaaPbx2YHpt1gv9SLupJTMe";

  if (testMode) {
    const claimerPk = new PublicKey(TEST_CLAIMER);
    const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpc, "confirmed");

    // Just verify tx exists and receipt was created
    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), u64LE(epoch), claimerPk.toBuffer()],
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
    });
  }
  // ========== END TESTING MODE ==========

  // ========== PRODUCTION MODE ==========
  const ctx = await getAccessContext();
  if (!ctx.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");

  // V2: userKey-based receipt PDA
  if (version === 2) {
    if (!userKeyHex) return NextResponse.json({ error: "missing_user_key_hex" }, { status: 400 });
    if (!claimerWallet) return NextResponse.json({ error: "missing_claimer" }, { status: 400 });

    const userKeyBytes = fromHex32(userKeyHex);
    const claimerPk = new PublicKey(claimerWallet);

    // V2 Receipt PDA
    const [receiptV2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt_v2"), u64LE(epoch), userKeyBytes],
      getProgramId()
    );

    // Get the leaf to find the weekKey
    const leaf = await db.claimLeaf.findFirst({
      where: { epoch: Number(epoch), userId: ctx.user.id },
    });

    if (!leaf) {
      return NextResponse.json({ error: "no_claim_leaf" }, { status: 400 });
    }

    const weekKey = leaf.weekKey;

    // Helper function to mark as claimed
    async function markClaimedInDbV2(txSig: string) {
      const updated = await db.rewardEvent.updateMany({
        where: {
          userId: ctx.user!.id,
          weekKey,
          claimedAt: null,
        },
        data: { claimedAt: new Date(), txSig },
      });

      if (updated.count === 0) {
        const syntheticRefId = `claim-v2-${ctx.user!.id}-${weekKey}`;
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
            amount: leaf!.amountAtomic,
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

    // IDEMPOTENT: If receipt already exists, return success
    const receiptInfo = await connection.getAccountInfo(receiptV2Pda, "confirmed");
    if (receiptInfo && receiptInfo.owner.equals(getProgramId())) {
      await markClaimedInDbV2(signature);

      const userAta = getAssociatedTokenAddressSync(getXessMint(), claimerPk);
      return NextResponse.json({
        ok: true,
        version: 2,
        alreadyClaimed: true,
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
      receiptV2: receiptV2Pda.toBase58(),
      userAta: userAta.toBase58(),
      transferred: transferred.toString(),
    });
  }

  // V1: wallet-based receipt PDA
  const wallet = (ctx.user.solWallet || ctx.user.walletAddress || "").trim();
  if (!wallet) return NextResponse.json({ error: "no_wallet_linked" }, { status: 400 });
  const claimerPk = new PublicKey(wallet);

  // Receipt PDA
  const [receiptPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), u64LE(epoch), claimerPk.toBuffer()],
    getProgramId()
  );

  // Get the leaf to find the weekKey - REQUIRED for history tracking
  const leaf = await db.claimLeaf.findUnique({
    where: { epoch_wallet: { epoch: Number(epoch), wallet } },
  });

  // Hard-fail if no ClaimLeaf exists - cannot record history without it
  if (!leaf) {
    return NextResponse.json({ error: "no_claim_leaf" }, { status: 400 });
  }

  const weekKey = leaf.weekKey;

  // Helper function to ensure RewardEvent exists and is marked claimed
  async function markClaimedInDb(txSig: string) {
    // First, try to update existing RewardEvent rows (remove status constraint)
    const updated = await db.rewardEvent.updateMany({
      where: {
        userId: ctx.user!.id,
        weekKey,
        claimedAt: null,
      },
      data: { claimedAt: new Date(), txSig },
    });

    // If no rows were updated, create a synthetic RewardEvent so history is preserved
    if (updated.count === 0) {
      const syntheticRefId = `claim-${ctx.user!.id}-${weekKey}`;
      await db.rewardEvent.upsert({
        where: {
          refType_refId: {
            refType: "CLAIM",
            refId: syntheticRefId,
          },
        },
        create: {
          userId: ctx.user!.id,
          weekKey,
          type: "WEEKLY_LIKES",
          amount: leaf!.amountAtomic,
          status: "PAID",
          refType: "CLAIM",
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

  // IDEMPOTENT: If receipt already exists, return success
  const receiptInfo = await connection.getAccountInfo(receiptPda, "confirmed");
  if (receiptInfo && receiptInfo.owner.equals(getProgramId())) {
    // Already claimed - ensure DB is updated and return ok
    await markClaimedInDb(signature);

    const userAta = getAssociatedTokenAddressSync(getXessMint(), claimerPk);
    return NextResponse.json({
      ok: true,
      alreadyClaimed: true,
      receipt: receiptPda.toBase58(),
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

  // Ensure our program is in the transaction account keys
  if (!keys.some((k) => k.equals(getProgramId()))) {
    return NextResponse.json({ error: "wrong_program" }, { status: 400 });
  }

  // Re-check receipt after tx verification (it should exist now)
  const receiptInfoAfter = await connection.getAccountInfo(receiptPda, "confirmed");
  if (!receiptInfoAfter) return NextResponse.json({ error: "receipt_missing" }, { status: 400 });
  if (!receiptInfoAfter.owner.equals(getProgramId())) {
    return NextResponse.json({ error: "receipt_wrong_owner" }, { status: 400 });
  }

  // Get expected amount from leaf (guaranteed to exist from earlier check)
  const expected = leaf.amountAtomic;

  // Validate the SPL transfer: vault ATA -> user ATA
  const userAta = getAssociatedTokenAddressSync(getXessMint(), claimerPk);

  const inner = tx.meta?.innerInstructions ?? [];
  let transferred = 0n;

  for (const group of inner) {
    for (const ix of group.instructions) {
      const prog = keys[ix.programIdIndex];
      if (!prog?.equals(TOKEN_PROGRAM_ID)) continue;

      const data = Buffer.from(ix.data, "base64");
      if (data.length < 9) continue;
      if (data[0] !== 3) continue; // SPL Token Transfer

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

  // Mark rewards as claimed using weekKey
  await markClaimedInDb(signature);

  return NextResponse.json({
    ok: true,
    receipt: receiptPda.toBase58(),
    userAta: userAta.toBase58(),
    transferred: transferred.toString(),
  });
}
