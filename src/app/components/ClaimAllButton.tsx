"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { sendSignedTx } from "@/lib/sendSignedTx";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { toast } from "sonner";

function hexToU8_32(hex: string): number[] {
  const h = hex.trim().startsWith("0x") ? hex.trim().slice(2) : hex.trim();
  if (h.length !== 64) throw new Error(`Bad proof element length: ${h.length}`);
  const buf = Buffer.from(h, "hex");
  return Array.from(buf);
}

/* ── Dark-blue claim toast style ─────────────────────────── */
const claimToastStyle = {
  background: "linear-gradient(135deg, rgba(15, 23, 42, 0.97), rgba(10, 15, 30, 0.98))",
  border: "1px solid rgba(59, 130, 246, 0.35)",
  color: "#e2e8f0",
  backdropFilter: "blur(12px)",
  boxShadow: "0 4px 24px rgba(59, 130, 246, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.1)",
} as const;

const claimToastOpts = {
  style: claimToastStyle,
  duration: Infinity,
  classNames: {
    toast: "!bg-none",
  },
} as const;

function claimLoading(id: string | number, message: string, description?: string) {
  toast.loading(message, {
    id,
    description,
    ...claimToastOpts,
  });
}

function claimSuccess(id: string | number, message: string, description?: string) {
  toast.success(message, {
    id,
    description,
    style: {
      ...claimToastStyle,
      border: "1px solid rgba(34, 197, 94, 0.5)",
      boxShadow: "0 4px 24px rgba(34, 197, 94, 0.15), 0 0 0 1px rgba(34, 197, 94, 0.1)",
    },
    duration: 6000,
    classNames: { toast: "!bg-none" },
  });
}

function claimError(id: string | number, message: string, description?: string) {
  toast.error(message, {
    id,
    description,
    style: {
      ...claimToastStyle,
      border: "1px solid rgba(239, 68, 68, 0.5)",
      boxShadow: "0 4px 24px rgba(239, 68, 68, 0.15), 0 0 0 1px rgba(239, 68, 68, 0.1)",
    },
    duration: 5000,
    classNames: { toast: "!bg-none" },
  });
}

function claimPending(id: string | number, message: string, description?: string) {
  toast(message, {
    id,
    description,
    style: {
      ...claimToastStyle,
      border: "1px solid rgba(234, 179, 8, 0.55)",
      boxShadow: "0 4px 24px rgba(234, 179, 8, 0.12), 0 0 0 1px rgba(234, 179, 8, 0.08)",
    },
    duration: 12000,
    classNames: { toast: "!bg-none" },
  });
}

async function confirmWithBackend(payload: Record<string, unknown>) {
  const res = await fetch("/api/rewards/claim/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok && j?.ok, status: res.status, body: j };
}

interface Props {
  onSuccess?: () => void;
  className?: string;
}

export default function ClaimAllButton({ onSuccess, className }: Props) {
  const { connected, publicKey, signTransaction } = useWallet();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<{
    count: number;
    totalXess: string;
    txSigs: string[];
  } | null>(null);

  async function handleClaim() {
    if (!connected || !publicKey || !signTransaction) {
      toast.error("Connect a wallet to claim");
      return;
    }

    setBusy(true);
    setProgress("Loading claim data...");
    setResult(null);

    const tid = "claim-all";

    try {
      /* ── Step 1: Fetch claimable epochs ── */
      claimLoading(tid, "Fetching available rewards...", "Checking for unclaimed XESS payouts");

      const allRes = await fetch("/api/rewards/claim/all");
      const allData = await allRes.json();

      if (!allData.ok || !allData.claimableEpochs?.length) {
        toast.dismiss(tid);
        toast.info("No tokens ready to claim yet.", {
          description: "Rewards become claimable after they are published on-chain.",
          style: claimToastStyle,
          duration: 4000,
          classNames: { toast: "!bg-none" },
        });
        return;
      }

      const total = allData.claimableEpochs.length;

      /* ── Step 2: Initialize program ── */
      claimLoading(
        tid,
        `Found ${total} reward period${total > 1 ? "s" : ""} to claim`,
        "Initializing Solana program..."
      );

      const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
      const connection = new Connection(rpc, "confirmed");

      const programId = new PublicKey(allData.programId);
      const idl = await anchor.Program.fetchIdl(programId, { connection } as any);
      if (!idl) throw new Error("Program IDL not found");

      const anchorProvider = { connection, publicKey } as anchor.Provider;
      const program = new anchor.Program(
        { ...idl, address: programId.toBase58() } as anchor.Idl,
        anchorProvider
      );

      const mint = new PublicKey(allData.xessMint);
      const userAta = getAssociatedTokenAddressSync(mint, publicKey);

      let successCount = 0;
      let pendingCount = 0;
      const txSigs: string[] = [];
      const pendingSigs: string[] = [];
      let claimedAmount = 0n;

      /* ── Step 3: Process each epoch ── */
      for (let i = 0; i < total; i++) {
        const epoch = allData.claimableEpochs[i];
        const label = `${i + 1}/${total}`;

        claimLoading(
          tid,
          `Claiming period ${label}`,
          `Building transaction for ${epoch.weekKey}...`
        );
        setProgress(`Claiming ${label}...`);

        try {
          if (epoch.version !== 2 && epoch.claimer && publicKey.toBase58() !== epoch.claimer) {
            throw new Error(`Wallet mismatch for epoch ${epoch.epoch}`);
          }

          const proofVec: number[][] = Array.isArray(epoch.proof)
            ? epoch.proof.map((p: string) => Array.from(hexToU8_32(p)))
            : [];
          const salt32: number[] = Array.from(hexToU8_32(epoch.claimSaltHex));

          const isV2 = epoch.version === 2;
          const claimIx = isV2
            ? await program.methods
                .claimV2(
                  new anchor.BN(epoch.epoch),
                  new anchor.BN(epoch.amountAtomic),
                  epoch.index,
                  salt32,
                  proofVec
                )
                .accounts({
                  config: new PublicKey(epoch.pdas.config),
                  vaultAuthority: new PublicKey(epoch.pdas.vaultAuthority),
                  epochRoot: new PublicKey(epoch.pdas.epochRoot),
                  receiptV2: new PublicKey(epoch.pdas.receiptV2),
                  claimer: publicKey,
                  vaultAta: new PublicKey(allData.vaultAta),
                  userAta,
                  tokenProgram: TOKEN_PROGRAM_ID,
                  systemProgram: anchor.web3.SystemProgram.programId,
                })
                .instruction()
            : await program.methods
                .claim(
                  new anchor.BN(epoch.epoch),
                  new anchor.BN(epoch.amountAtomic),
                  epoch.index,
                  proofVec
                )
                .accounts({
                  config: new PublicKey(epoch.pdas.config),
                  vaultAuthority: new PublicKey(epoch.pdas.vaultAuthority),
                  epochRoot: new PublicKey(epoch.pdas.epochRoot),
                  receipt: new PublicKey(epoch.pdas.receipt),
                  claimer: publicKey,
                  vaultAta: new PublicKey(allData.vaultAta),
                  userAta,
                  tokenProgram: TOKEN_PROGRAM_ID,
                  systemProgram: anchor.web3.SystemProgram.programId,
                })
                .instruction();

          /* ── Wallet approval ── */
          claimLoading(
            tid,
            `Claiming period ${label}`,
            "Approve the transaction in your wallet..."
          );

          const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash("confirmed");
          const tx = new Transaction({
            feePayer: publicKey,
            blockhash,
            lastValidBlockHeight,
          });

          // Create ATA if first claim
          if (i === 0) {
            const ataInfo = await connection.getAccountInfo(userAta);
            if (!ataInfo) {
              tx.add(
                createAssociatedTokenAccountInstruction(
                  publicKey,
                  userAta,
                  publicKey,
                  mint,
                  TOKEN_PROGRAM_ID,
                  ASSOCIATED_TOKEN_PROGRAM_ID
                )
              );
            }
          }

          tx.add(claimIx);
          const signed = await signTransaction(tx);

          /* ── Submitting ── */
          claimLoading(
            tid,
            `Claiming period ${label}`,
            "Submitting transaction to the network..."
          );

          const sig = await sendSignedTx(signed, connection);

          /* ── Confirming with backend ── */
          claimLoading(
            tid,
            `Claiming period ${label}`,
            "Confirming on-chain and recording claim..."
          );

          const confirmPayload = {
            signature: sig,
            epoch: epoch.epoch,
            version: epoch.version ?? 1,
            userKeyHex: epoch.userKeyHex,
            claimer: publicKey.toBase58(),
          };

          const { ok: confirmOk, body: confirmBody } =
            await confirmWithBackend(confirmPayload);

          if (confirmOk) {
            successCount++;
            txSigs.push(sig);
            claimedAmount += BigInt(epoch.amountAtomic);
          } else {
            const errCode = confirmBody?.error;

            // Receipt/tx not visible yet — retry with backoff
            if (errCode === "tx_not_found" || errCode === "receipt_missing") {
              claimPending(
                tid,
                `Claim pending ${label}`,
                "Transaction sent. Waiting for Solana to finalize..."
              );

              let retryConfirmed = false;
              const delays = [800, 1500, 2500, 4000, 6500];
              for (const d of delays) {
                await new Promise((r) => setTimeout(r, d));
                const retry = await confirmWithBackend(confirmPayload);
                if (retry.ok) {
                  retryConfirmed = true;
                  break;
                }
              }

              if (retryConfirmed) {
                successCount++;
                txSigs.push(sig);
                claimedAmount += BigInt(epoch.amountAtomic);
              } else {
                // Tx sent but not finalized within retry window
                pendingCount++;
                pendingSigs.push(sig);
                continue; // move to next epoch
              }
            } else {
              // Hard error from backend verification
              throw new Error(errCode || "claim_confirm_failed");
            }
          }
        } catch (epochErr: any) {
          const msg = epochErr?.message || "Unknown error";
          if (msg.includes("User rejected") || msg.includes("rejected")) {
            claimError(tid, "Claim cancelled", "You rejected the transaction in your wallet.");
            return;
          }
          console.error(`Failed to claim epoch ${epoch.epoch}:`, epochErr);
          // Continue to next epoch
        }
      }

      /* ── Final result ── */
      if (successCount > 0) {
        const wholeXess = claimedAmount / 1_000_000_000n;
        const remainder = claimedAmount % 1_000_000_000n;
        const decimal = Number(remainder) / 1_000_000_000;
        const totalXess = (Number(wholeXess) + decimal).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        });
        setResult({ count: successCount, totalXess, txSigs });

        claimSuccess(
          tid,
          `Claimed ${totalXess} XESS`,
          pendingCount > 0
            ? `${successCount}/${total} confirmed. ${pendingCount} pending finalization.`
            : `${successCount}/${total} reward period${total > 1 ? "s" : ""} claimed successfully.`
        );

        window.dispatchEvent(new Event("xess-claimed"));
        onSuccess?.();
      } else if (pendingCount > 0) {
        claimPending(
          tid,
          "Claims submitted",
          `${pendingCount}/${total} transaction${pendingCount > 1 ? "s were" : " was"} sent and may still be finalizing. Check again shortly.`
        );
      } else {
        claimError(tid, "Claim failed", "Could not process any reward periods. Please try again.");
      }
    } catch (err: any) {
      console.error("Claim error:", err);
      const msg = err?.message || "Claim failed";
      if (msg.includes("User rejected") || msg.includes("rejected")) {
        claimError(tid, "Claim cancelled", "You rejected the transaction in your wallet.");
      } else {
        claimError(tid, "Claim failed", msg);
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  if (!connected) {
    return (
      <p className={`text-xs text-white/50 text-center py-2 ${className || ""}`}>
        Connect your wallet to claim tokens
      </p>
    );
  }

  if (result) {
    const explorer = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta"
      ? "https://solscan.io/tx/"
      : "https://explorer.solana.com/tx/";
    const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta"
      ? ""
      : "?cluster=devnet";

    return (
      <div className={`space-y-2 ${className || ""}`}>
        <div className="bg-green-500/20 border border-green-400/50 rounded-xl p-3 text-center">
          <p className="text-green-400 font-bold text-sm">
            Claimed {result.totalXess} XESS ({result.count} week{result.count !== 1 ? "s" : ""})
          </p>
          <div className="mt-2 space-y-1">
            {result.txSigs.map((sig) => (
              <a
                key={sig}
                href={`${explorer}${sig}${cluster}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[10px] text-green-300/70 hover:text-green-300 underline truncate"
              >
                {sig}
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleClaim}
      disabled={busy}
      className={`w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold hover:from-green-600 hover:to-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm ${className || ""}`}
    >
      {busy ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {progress || "Claiming..."}
        </span>
      ) : (
        "Claim All XESS"
      )}
    </button>
  );
}
