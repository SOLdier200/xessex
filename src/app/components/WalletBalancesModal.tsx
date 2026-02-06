"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AnimatePresence, motion } from "framer-motion";

interface Balances {
  sol: { lamports: number; formatted: string };
  xess: { atomic: string; formatted: string };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletBalancesModal({ isOpen, onClose }: Props) {
  const { publicKey, connected } = useWallet();
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2"
          >
            <div className="rounded-2xl border border-white/10 bg-black/90 backdrop-blur-md shadow-2xl overflow-hidden">
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
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-xs text-white/40 mb-1">Connected Wallet</p>
                      <p className="text-white font-mono text-sm break-all">
                        {publicKey?.toBase58()}
                      </p>
                    </div>

                    {/* Balances Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* SOL Balance */}
                      <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-4 border border-purple-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                            <span className="text-white font-bold text-xs">SOL</span>
                          </div>
                          <span className="text-white/60 text-sm">Solana</span>
                        </div>
                        <p className="text-2xl font-bold text-white">
                          {balances.sol.formatted}
                        </p>
                        <p className="text-xs text-white/40 mt-1">
                          ~${(parseFloat(balances.sol.formatted) * 76).toFixed(2)} USD
                        </p>
                      </div>

                      {/* XESS Balance */}
                      <div className="bg-gradient-to-br from-pink-500/20 to-pink-600/10 rounded-xl p-4 border border-pink-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center">
                            <span className="text-white font-bold text-xs">X</span>
                          </div>
                          <span className="text-white/60 text-sm">XESS</span>
                        </div>
                        <p className="text-2xl font-bold text-white">
                          {Number(balances.xess.formatted).toLocaleString()}
                        </p>
                        <p className="text-xs text-white/40 mt-1">
                          XESS Token
                        </p>
                      </div>
                    </div>

                    {/* Refresh Button */}
                    <button
                      onClick={fetchBalances}
                      disabled={loading}
                      className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/80 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
