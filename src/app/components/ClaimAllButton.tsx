"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
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

    try {
      const allRes = await fetch("/api/rewards/claim/all");
      const allData = await allRes.json();

      if (!allData.ok || !allData.claimableEpochs?.length) {
        toast.info("No tokens ready to claim yet. Rewards become claimable after they are published on-chain.");
        return;
      }

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
      const total = allData.claimableEpochs.length;
      const txSigs: string[] = [];
      let claimedAmount = 0n;

      for (let i = 0; i < total; i++) {
        const epoch = allData.claimableEpochs[i];
        setProgress(`Claiming ${i + 1}/${total} (${epoch.weekKey})...`);

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
          const sig = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
          });
          await connection.confirmTransaction(sig, "confirmed");

          // Confirm with backend
          await fetch("/api/rewards/claim/confirm", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              signature: sig,
              epoch: epoch.epoch,
              version: epoch.version ?? 1,
              userKeyHex: epoch.userKeyHex,
              claimer: publicKey.toBase58(),
            }),
          });

          successCount++;
          txSigs.push(sig);
          claimedAmount += BigInt(epoch.amountAtomic);
        } catch (epochErr) {
          console.error(`Failed to claim epoch ${epoch.epoch}:`, epochErr);
        }
      }

      if (successCount > 0) {
        const wholeXess = claimedAmount / 1_000_000_000n;
        const remainder = claimedAmount % 1_000_000_000n;
        const decimal = Number(remainder) / 1_000_000_000;
        const totalXess = (Number(wholeXess) + decimal).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        });
        setResult({ count: successCount, totalXess, txSigs });
        toast.success(`Claimed ${totalXess} XESS (${successCount}/${total} weeks)`);
        onSuccess?.();
      } else {
        toast.error("Failed to claim tokens");
      }
    } catch (err: any) {
      console.error("Claim error:", err);
      toast.error(err.message || "Claim failed");
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
        <button
          onClick={() => setResult(null)}
          className="w-full py-2.5 rounded-xl bg-white/5 border border-white/20 text-white/70 font-semibold hover:bg-white/10 transition text-sm"
        >
          Claim More XESS
        </button>
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
