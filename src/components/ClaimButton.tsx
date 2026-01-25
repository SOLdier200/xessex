"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { claimXessV2 } from "@/lib/claimV2Client";

interface ClaimButtonProps {
  epoch: number;
  amountDisplay?: string; // e.g., "12.5 XESS"
  onSuccess?: (signature: string) => void;
  onError?: (error: Error) => void;
}

export function ClaimButton({ epoch, amountDisplay, onSuccess, onError }: ClaimButtonProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [sig, setSig] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onClaim = async () => {
    setErr(null);
    setSig(null);

    if (!wallet.connected || !wallet.publicKey) {
      setErr("Connect a Solana wallet to claim.");
      return;
    }

    setLoading(true);
    try {
      // wallet-adapter gives a WalletContextState; Anchor expects a Wallet-like object.
      // The adapter object works because it exposes signTransaction/signAllTransactions.
      const { signature } = await claimXessV2({
        epoch,
        wallet: wallet as any,
        connection,
      });

      setSig(signature);
      onSuccess?.(signature);
    } catch (e: any) {
      const errorMsg = e?.message || String(e);
      setErr(errorMsg);
      onError?.(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
      </div>

      {wallet.connected && (
        <button
          className="rounded-xl px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          onClick={onClaim}
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
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
              Claiming...
            </span>
          ) : (
            <>Claim {amountDisplay || "XESS"}</>
          )}
        </button>
      )}

      {!wallet.connected && (
        <p className="text-sm text-gray-500">Connect your wallet to claim rewards</p>
      )}

      {sig && (
        <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">
          <p className="font-medium">Claim successful!</p>
          <a
            href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs break-all underline hover:text-green-700"
          >
            View transaction: {sig.slice(0, 20)}...
          </a>
        </div>
      )}

      {err && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <p className="font-medium">Claim failed</p>
          <p className="text-xs">{err}</p>
        </div>
      )}
    </div>
  );
}
