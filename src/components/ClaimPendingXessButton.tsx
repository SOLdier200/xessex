"use client";

import { useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { sendSignedTx } from "@/lib/sendSignedTx";
import * as anchor from "@coral-xyz/anchor";
import { buildClaimTx, ClaimPreparePayload } from "@/lib/xessClaimTx";

function explorer(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

export function ClaimPendingXessButton() {
  const [loading, setLoading] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setErr(null);
    setTxSig(null);
    setLoading(true);

    try {
      // Backend auto-detects the latest on-chain epoch
      const resp = await fetch("/api/rewards/claim/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      const prep = (await resp.json()) as any;
      if (!prep.ok) throw new Error(prep.error || "prepare_failed");
      if (!prep.claimable) throw new Error(prep.reason || "not_claimable");

      // wallet (Phantom)
      const provider = (window as any).solana;
      if (!provider?.isPhantom) throw new Error("phantom_not_found");
      await provider.connect();

      const walletPubkey = new PublicKey(provider.publicKey.toString());

      // connection (devnet helius or your NEXT_PUBLIC rpc)
      const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
      const connection = new Connection(rpc, "confirmed");

      // load IDL from chain
      const idl = await anchor.Program.fetchIdl(new PublicKey(prep.programId), {
        connection,
      } as any);
      if (!idl) throw new Error("idl_not_found");

      const { tx } = await buildClaimTx({
        connection,
        walletPubkey,
        idl,
        prepare: prep as ClaimPreparePayload,
      });

      const signed = await provider.signTransaction(tx);
      const sig = await sendSignedTx(signed, connection);

      setTxSig(sig);

      // confirm in backend (marks DB)
      await fetch("/api/rewards/claim/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signature: sig, epoch: prep.epoch }),
      }).catch(() => {});
    } catch (e: any) {
      setErr(e?.message || "unknown_error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={onClick}
        disabled={loading}
        className="w-full rounded-xl px-4 py-3 font-semibold bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-400 hover:to-pink-400 disabled:opacity-50 transition"
      >
        {loading ? "Claiming..." : "Claim Pending XESS"}
      </button>

      {txSig && (
        <div className="text-sm text-white/80">
          Sent:{" "}
          <a className="underline text-pink-400 hover:text-pink-300" href={explorer(txSig)} target="_blank" rel="noreferrer">
            {txSig.slice(0, 6)}…{txSig.slice(-6)}
          </a>
        </div>
      )}

      {err && <div className="text-sm text-red-400">{err}</div>}
    </div>
  );
}
