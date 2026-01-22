/**
 * Weekly Payout Script
 *
 * Sends real XESS tokens on-chain from treasury to users and marks RewardEvents as PAID.
 * Run via: npx tsx scripts/weekly-payout.ts
 *
 * Required env vars:
 *   SOLANA_RPC_URL - RPC endpoint (e.g., https://api.mainnet-beta.solana.com)
 *   XESS_MINT - The XESS token mint address
 *   XESS_TREASURY_KEYPAIR_PATH - Path to treasury keypair JSON file
 *   XESS_TREASURY_PUBKEY - (Optional) Treasury public key if different from keypair
 */

import "dotenv/config";
import * as fs from "fs";
import { PrismaClient } from "@prisma/client";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { formatXess } from "./xessMath";

const db = new PrismaClient();

// ============================================
// CONFIGURATION
// ============================================

const RPC = process.env.SOLANA_RPC_URL;
const MINT_STR = process.env.XESS_MINT;
const TREASURY_KEYPAIR_PATH = process.env.XESS_TREASURY_KEYPAIR_PATH;
const TREASURY_PUBKEY_STR = process.env.XESS_TREASURY_PUBKEY;

const DECIMALS = 9;

// Batch settings
const MAX_TRANSFERS_PER_TX = 5; // Keep transactions small for reliability
const DELAY_BETWEEN_TXS_MS = 1000; // Rate limiting

// ============================================
// HELPERS
// ============================================

function loadKeypair(path: string): Keypair {
  const raw = fs.readFileSync(path, "utf8");
  const secret = Uint8Array.from(JSON.parse(raw));
  return Keypair.fromSecretKey(secret);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// MAIN
// ============================================

async function main() {
  // Validate env
  if (!RPC) throw new Error("SOLANA_RPC_URL not set");
  if (!MINT_STR) throw new Error("XESS_MINT not set");
  if (!TREASURY_KEYPAIR_PATH) throw new Error("XESS_TREASURY_KEYPAIR_PATH not set");

  const MINT = new PublicKey(MINT_STR);
  const conn = new Connection(RPC, "confirmed");
  const treasury = loadKeypair(TREASURY_KEYPAIR_PATH);
  const treasuryPk = TREASURY_PUBKEY_STR
    ? new PublicKey(TREASURY_PUBKEY_STR)
    : treasury.publicKey;

  console.log(`[weekly-payout] Treasury: ${treasuryPk.toBase58()}`);
  console.log(`[weekly-payout] Mint: ${MINT.toBase58()}`);

  // Get treasury ATA
  const treasuryAta = await getAssociatedTokenAddress(MINT, treasuryPk);
  console.log(`[weekly-payout] Treasury ATA: ${treasuryAta.toBase58()}`);

  // Check treasury balance
  const treasuryInfo = await conn.getTokenAccountBalance(treasuryAta);
  console.log(`[weekly-payout] Treasury balance: ${treasuryInfo.value.uiAmountString} XESS`);

  // Load pending rewards
  const pending = await db.rewardEvent.findMany({
    where: { status: "PENDING" },
    select: { id: true, userId: true, amount: true, weekKey: true, type: true },
  });

  if (pending.length === 0) {
    console.log("[weekly-payout] No pending rewards to pay out");
    return;
  }

  console.log(`[weekly-payout] Found ${pending.length} pending reward events`);

  // Get user wallets for all pending rewards
  const userIds = [...new Set(pending.map((p) => p.userId))];
  const users = await db.user.findMany({
    where: { id: { in: userIds }, solWallet: { not: null } },
    select: { id: true, solWallet: true },
  });

  const walletByUser = new Map(users.map((u) => [u.id, u.solWallet!]));
  console.log(`[weekly-payout] Found ${walletByUser.size} users with linked wallets`);

  // Aggregate amounts per wallet + keep reward ids
  type PayInfo = { amount: bigint; rewardIds: string[] };
  const payMap = new Map<string, PayInfo>();

  for (const p of pending) {
    const wallet = walletByUser.get(p.userId);
    if (!wallet) continue; // Skip users without linked wallets

    const cur = payMap.get(wallet) || { amount: 0n, rewardIds: [] };
    cur.amount += BigInt(p.amount.toString());
    cur.rewardIds.push(p.id);
    payMap.set(wallet, cur);
  }

  if (payMap.size === 0) {
    console.log("[weekly-payout] No payable rewards (no users with linked wallets)");
    return;
  }

  console.log(`[weekly-payout] Will pay ${payMap.size} unique wallets`);

  // Calculate total to pay
  let totalToPay = 0n;
  for (const info of payMap.values()) {
    totalToPay += info.amount;
  }
  console.log(`[weekly-payout] Total to pay: ${formatXess(totalToPay)} XESS`);

  // Check if treasury has enough
  const treasuryBalance = BigInt(treasuryInfo.value.amount);
  if (treasuryBalance < totalToPay) {
    console.error(`[weekly-payout] ERROR: Treasury has insufficient funds!`);
    console.error(`  Needed: ${formatXess(totalToPay)} XESS`);
    console.error(`  Available: ${formatXess(treasuryBalance)} XESS`);
    process.exit(1);
  }

  // Process payouts
  let paidCount = 0;
  let failedCount = 0;

  for (const [wallet, info] of payMap.entries()) {
    try {
      const recipient = new PublicKey(wallet);
      const recipientAta = await getAssociatedTokenAddress(MINT, recipient);

      // Check if recipient ATA exists
      const ataInfo = await conn.getAccountInfo(recipientAta);

      const tx = new Transaction();

      // Create ATA if it doesn't exist
      if (!ataInfo) {
        console.log(`[weekly-payout] Creating ATA for ${wallet.slice(0, 8)}...`);
        tx.add(
          createAssociatedTokenAccountInstruction(
            treasuryPk, // payer
            recipientAta,
            recipient,
            MINT
          )
        );
      }

      // Add transfer instruction
      tx.add(
        createTransferCheckedInstruction(
          treasuryAta,
          MINT,
          recipientAta,
          treasuryPk,
          BigInt(info.amount.toString()),
          DECIMALS
        )
      );

      // Get recent blockhash
      const { blockhash } = await conn.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = treasuryPk;

      // Send and confirm
      const sig = await sendAndConfirmTransaction(conn, tx, [treasury], {
        commitment: "confirmed",
      });

      // Mark all included RewardEvents as PAID
      await db.rewardEvent.updateMany({
        where: { id: { in: info.rewardIds } },
        data: {
          status: "PAID",
          txSig: sig,
          paidAt: new Date(),
        },
      });

      paidCount += info.rewardIds.length;
      console.log(
        `[weekly-payout] PAID ${wallet.slice(0, 8)}... - ${formatXess(info.amount)} XESS - ${info.rewardIds.length} rewards - tx: ${sig.slice(0, 16)}...`
      );

      // Rate limit
      await sleep(DELAY_BETWEEN_TXS_MS);
    } catch (error) {
      failedCount += info.rewardIds.length;
      console.error(`[weekly-payout] FAILED ${wallet.slice(0, 8)}...`, error);
    }
  }

  // Summary
  console.log(`\n[weekly-payout] === SUMMARY ===`);
  console.log(`[weekly-payout] Rewards paid: ${paidCount}`);
  console.log(`[weekly-payout] Rewards failed: ${failedCount}`);

  // Check remaining pending
  const stillPending = await db.rewardEvent.count({
    where: { status: "PENDING" },
  });
  console.log(`[weekly-payout] Still pending (no wallet linked): ${stillPending}`);

  console.log(`[weekly-payout] Done!`);
}

main()
  .then(() => db.$disconnect())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[weekly-payout] Error:", e);
    db.$disconnect();
    process.exit(1);
  });
