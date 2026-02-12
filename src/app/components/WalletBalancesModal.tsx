"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { toast } from "sonner";

interface Balances {
  sol: { lamports: number; formatted: string };
  xess: { atomic: string; formatted: string };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const XESS_MINT_STR = process.env.NEXT_PUBLIC_XESS_MINT ?? "";
const XESS_DECIMALS = 9;
const SOL_FEE_BUFFER = 0.005;

export default function WalletBalancesModal({ isOpen, onClose, inline }: Props) {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendMode, setSendMode] = useState<"sol" | "xess" | null>(null);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/wallet/balances?wallet=${publicKey.toBase58()}`);
      const data = await res.json();

      if (data.ok) {
        setBalances(data.balances);
      } else {
        setError(data.error || "Failed to fetch balances");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (isOpen && connected && publicKey) {
      fetchBalances();
    }
  }, [isOpen, connected, publicKey, fetchBalances]);

  // ESC to close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // Format wallet address for display
  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

  // Reset send form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSendMode(null);
      setSendTo("");
      setSendAmount("");
      setSending(false);
    }
  }, [isOpen]);

  function openSendForm(mode: "sol" | "xess") {
    setSendMode(mode);
    setSendTo("");
    setSendAmount("");
  }

  function validateRecipient(addr: string): PublicKey | null {
    try {
      const pk = new PublicKey(addr);
      if (!PublicKey.isOnCurve(pk)) return null;
      return pk;
    } catch {
      return null;
    }
  }

  function handleMax() {
    if (!balances) return;
    if (sendMode === "sol") {
      const max = Math.max(0, parseFloat(balances.sol.formatted) - SOL_FEE_BUFFER);
      setSendAmount(max > 0 ? max.toString() : "0");
    } else if (sendMode === "xess") {
      setSendAmount(balances.xess.formatted);
    }
  }

  async function handleSend() {
    if (!publicKey || !balances || !sendMode) return;

    const id = toast.loading(`Preparing ${sendMode === "sol" ? "SOL" : "XESS"} transfer...`);
    setSending(true);

    try {
      // Validate recipient
      const recipient = validateRecipient(sendTo);
      if (!recipient) {
        toast.error("Invalid recipient address", { id });
        setSending(false);
        return;
      }

      if (recipient.equals(publicKey)) {
        toast.error("Cannot send to yourself", { id });
        setSending(false);
        return;
      }

      // Validate amount
      const amount = parseFloat(sendAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error("Enter a valid amount", { id });
        setSending(false);
        return;
      }

      const connection = new Connection(RPC_ENDPOINT, "confirmed");
      const tx = new Transaction();

      if (sendMode === "sol") {
        const solBalance = parseFloat(balances.sol.formatted);
        if (amount > solBalance - SOL_FEE_BUFFER) {
          toast.error(`Insufficient SOL (need ${SOL_FEE_BUFFER} SOL for fees)`, { id });
          setSending(false);
          return;
        }

        tx.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipient,
            lamports: Math.round(amount * LAMPORTS_PER_SOL),
          })
        );
      } else {
        // XESS SPL transfer
        const xessBalance = parseFloat(balances.xess.formatted);
        if (amount > xessBalance) {
          toast.error("Insufficient XESS balance", { id });
          setSending(false);
          return;
        }

        if (!XESS_MINT_STR) {
          toast.error("XESS mint not configured", { id });
          setSending(false);
          return;
        }

        const mint = new PublicKey(XESS_MINT_STR);
        const senderAta = getAssociatedTokenAddressSync(mint, publicKey);
        const recipientAta = getAssociatedTokenAddressSync(mint, recipient);

        // Check if recipient ATA exists
        try {
          await getAccount(connection, recipientAta);
        } catch {
          // ATA doesn't exist — create it (sender pays)
          tx.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              recipientAta,
              recipient,
              mint,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }

        const atomicAmount = BigInt(Math.round(amount * 10 ** XESS_DECIMALS));
        tx.add(
          createTransferInstruction(
            senderAta,
            recipientAta,
            publicKey,
            atomicAmount
          )
        );
      }

      toast.loading("Waiting for wallet approval...", { id });
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const sig = await sendTransaction(tx, connection);

      toast.loading("Confirming transaction...", { id });
      await connection.confirmTransaction(sig, "confirmed");

      const tokenLabel = sendMode === "sol" ? "SOL" : "XESS";
      toast.success(`Sent ${sendAmount} ${tokenLabel}!`, { id });

      // Refresh balances and reset form
      setSendMode(null);
      setSendTo("");
      setSendAmount("");
      fetchBalances();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Transaction failed";
      if (msg.includes("User rejected") || msg.includes("rejected")) {
        toast.error("Transaction cancelled", { id });
      } else {
        toast.error(msg, { id });
      }
    } finally {
      setSending(false);
    }
  }

  const walletContent = (
    <>
      {!connected ? (
                  <div className="text-center py-8">
                    <p className="text-white/60 mb-4">No wallet connected</p>
                    <p className="text-sm text-white/40">
                      Connect your wallet to view balances
                    </p>
                  </div>
                ) : loading ? (
                  <div className="text-center py-8">
                    <div className="inline-block w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-white/60 mt-4">Loading balances...</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <p className="text-red-400 mb-4">{error}</p>
                    <button
                      onClick={fetchBalances}
                      className="px-4 py-2 bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 rounded-lg transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : balances ? (
                  <div className="space-y-4">
                    {/* Wallet Address */}
                    <button
                      type="button"
                      onClick={() => {
                        if (publicKey) {
                          navigator.clipboard.writeText(publicKey.toBase58());
                          toast.success("Copied!");
                        }
                      }}
                      className="w-full bg-white/5 hover:bg-white/10 rounded-xl p-4 text-left transition-colors cursor-pointer"
                    >
                      <p className="text-xs text-white/40 mb-1">Connected Wallet</p>
                      <p className="text-white font-mono text-sm break-all">
                        {publicKey?.toBase58()}
                      </p>
                    </button>

                    {/* Balances Grid */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {/* SOL Balance */}
                      <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-3 sm:p-4 border border-purple-500/20 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Image src="/logos/sol.jpg" alt="SOL" width={32} height={32} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover flex-shrink-0" />
                          <span className="text-white/60 text-xs sm:text-sm">Solana</span>
                        </div>
                        <p className="text-lg sm:text-2xl font-bold text-white truncate">
                          {balances.sol.formatted}
                        </p>
                        <p className="text-[10px] sm:text-xs text-white/40 mt-1">
                          ~${(parseFloat(balances.sol.formatted) * 76).toFixed(2)} USD
                        </p>
                        <button
                          onClick={() => openSendForm("sol")}
                          disabled={sending}
                          className="mt-2 sm:mt-3 w-full py-1.5 text-xs font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Send
                        </button>
                      </div>

                      {/* XESS Balance */}
                      <div className="bg-gradient-to-br from-pink-500/20 to-pink-600/10 rounded-xl p-3 sm:p-4 border border-pink-500/20 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Image src="/logos/xessexcoinlogo2.png" alt="XESS" width={32} height={32} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover flex-shrink-0" />
                          <span className="text-white/60 text-xs sm:text-sm">XESS</span>
                        </div>
                        <p className="text-lg sm:text-2xl font-bold text-white truncate">
                          {Number(balances.xess.formatted).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </p>
                        <p className="text-[10px] sm:text-xs text-white/40 mt-1">
                          XESS Token
                        </p>
                        <button
                          onClick={() => openSendForm("xess")}
                          disabled={sending}
                          className="mt-2 sm:mt-3 w-full py-1.5 text-xs font-medium bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Send
                        </button>
                      </div>
                    </div>

                    {/* Send Form */}
                    {sendMode && (
                      <div className={`rounded-xl p-4 border ${sendMode === "sol" ? "bg-purple-500/10 border-purple-500/20" : "bg-pink-500/10 border-pink-500/20"}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <Image
                            src={sendMode === "sol" ? "/logos/sol.jpg" : "/logos/xessexcoinlogo2.png"}
                            alt={sendMode === "sol" ? "SOL" : "XESS"}
                            width={20}
                            height={20}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                          <span className="text-sm font-medium text-white">
                            Send {sendMode === "sol" ? "SOL" : "XESS"}
                          </span>
                        </div>

                        {/* Recipient */}
                        <input
                          type="text"
                          placeholder="Recipient wallet address"
                          value={sendTo}
                          onChange={(e) => setSendTo(e.target.value.trim())}
                          disabled={sending}
                          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-pink-500/50 focus:outline-none text-sm font-mono mb-2 disabled:opacity-50"
                        />

                        {/* Amount + Max */}
                        <div className="flex gap-1.5 sm:gap-2 mb-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Amount"
                            value={sendAmount}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (/^\d*\.?\d*$/.test(v)) setSendAmount(v);
                            }}
                            disabled={sending}
                            className="flex-1 min-w-0 px-2 sm:px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-pink-500/50 focus:outline-none text-sm disabled:opacity-50"
                          />
                          <button
                            onClick={() => {
                              if (!balances) return;
                              if (sendMode === "sol") {
                                const quarter = Math.max(0, (parseFloat(balances.sol.formatted) - SOL_FEE_BUFFER) / 4);
                                setSendAmount(quarter > 0 ? quarter.toString() : "0");
                              } else if (sendMode === "xess") {
                                setSendAmount((parseFloat(balances.xess.formatted) / 4).toString());
                              }
                            }}
                            disabled={sending}
                            className="px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-medium bg-white/10 hover:bg-white/15 text-white/70 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                          >
                            25%
                          </button>
                          <button
                            onClick={() => {
                              if (!balances) return;
                              if (sendMode === "sol") {
                                const half = Math.max(0, (parseFloat(balances.sol.formatted) - SOL_FEE_BUFFER) / 2);
                                setSendAmount(half > 0 ? half.toString() : "0");
                              } else if (sendMode === "xess") {
                                setSendAmount((parseFloat(balances.xess.formatted) / 2).toString());
                              }
                            }}
                            disabled={sending}
                            className="px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-medium bg-white/10 hover:bg-white/15 text-white/70 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                          >
                            50%
                          </button>
                          <button
                            onClick={handleMax}
                            disabled={sending}
                            className="px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-medium bg-white/10 hover:bg-white/15 text-white/70 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                          >
                            Max
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={handleSend}
                            disabled={sending || !sendTo || !sendAmount}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 ${
                              sendMode === "sol"
                                ? "bg-purple-500 hover:bg-purple-600 text-white"
                                : "bg-pink-500 hover:bg-pink-600 text-white"
                            }`}
                          >
                            {sending ? "Sending..." : "Send"}
                          </button>
                          <button
                            onClick={() => setSendMode(null)}
                            disabled={sending}
                            className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
      ) : null}
    </>
  );

  if (inline) {
    return <div className="neon-border rounded-2xl p-4 md:p-6 bg-black/30">{walletContent}</div>;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
            onClick={onClose}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-black/90 backdrop-blur-md shadow-2xl overflow-hidden my-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <h2 className="text-xl font-bold text-white">Wallet Balances</h2>
                <button
                  onClick={onClose}
                  className="text-white/60 hover:text-white transition-colors text-2xl leading-none"
                >
                  &times;
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6">
                {walletContent}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
