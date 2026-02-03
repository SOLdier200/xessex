"use client";

import { useState, useEffect } from "react";
import TopNav from "../../components/TopNav";
import Image from "next/image";
import WalletActions from "@/components/WalletActions";
import Link from "next/link";

const WALLETS = [
  {
    name: "Phantom",
    url: "https://phantom.app/download",
    logo: "/logos/phantomtrans.png",
    description: "Most popular Solana wallet",
  },
  {
    name: "Solflare",
    url: "https://solflare.com/download",
    logo: "/logos/solflaretrans.png",
    description: "Feature-rich Solana wallet",
  },
  {
    name: "Backpack",
    url: "https://backpack.app/download",
    logo: "/logos/backpacktrans.png",
    description: "Next-gen crypto wallet",
  },
];

export default function DiamondLoginPage() {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMod, setIsMod] = useState(false);
  const [isAdminRole, setIsAdminRole] = useState(false);

  useEffect(() => {
    fetch("/api/me/is-admin")
      .then((res) => res.json())
      .then((data) => {
        setIsAdmin(data.isAdmin);
        setIsMod(data.isMod);
        setIsAdminRole(data.isAdminRole);
      })
      .catch(() => {
        setIsAdmin(false);
        setIsMod(false);
        setIsAdminRole(false);
      });
  }, []);

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10 flex justify-center">
        <div className="w-full max-w-xl space-y-6">
          {/* Diamond Login - Wallet Only */}
          <div className="rounded-2xl p-6 bg-black/30 border-2 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
            <div className="flex justify-center mb-4">
              <Image
                src="/logos/textlogo/siteset3/login100.png"
                alt="Diamond Login"
                width={938}
                height={276}
                className="h-[62px] w-auto"
              />
            </div>
            <div className="mb-4">
              <WalletActions mode="WALLET_LOGIN" />
            </div>
            <p className="text-sm text-white/70">
              Connect your wallet to sign in.
            </p>
            <p className="mt-2 text-xs text-purple-400 animate-pulse">
              Note: All mobile users will need to download Phantom and select Open in Phantom to connect.
            </p>

            {/* Need a wallet? */}
            <div className="mt-6 pt-4 border-t border-white/10 text-center">
              <button
                onClick={() => setShowWalletModal(true)}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition underline"
              >
                Need a wallet? Get one here
              </button>
            </div>

            {/* Moderator Dashboard - Only visible for MOD role */}
            {isMod && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <Link
                  href="/mod"
                  className="w-full py-3 px-6 rounded-xl bg-purple-500/20 border border-purple-400/50 text-purple-300 font-semibold hover:bg-purple-500/30 transition flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  Moderator Dashboard
                </Link>
              </div>
            )}

            {/* Admin Panel - Only visible for ADMIN role */}
            {isAdminRole && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <Link
                  href="/admin"
                  className="w-full py-3 px-6 rounded-xl bg-pink-500/20 border border-pink-400/50 text-pink-300 font-semibold hover:bg-pink-500/30 transition flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                  Admin Panel
                </Link>
              </div>
            )}

            {/* Admin Panel (by wallet allowlist) - fallback for admins not in DB */}
            {isAdmin && !isAdminRole && !isMod && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <Link
                  href="/admin"
                  className="w-full py-3 px-6 rounded-xl bg-pink-500/20 border border-pink-400/50 text-pink-300 font-semibold hover:bg-pink-500/30 transition flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                  Admin Panel
                </Link>
              </div>
            )}
          </div>

          <div className="text-center space-y-2">
            <Link
              href="/"
              className="text-white/50 hover:text-white/70 text-sm block"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>

      {/* Wallet Download Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowWalletModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-gray-900 border border-white/20 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <button
              onClick={() => setShowWalletModal(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-xl font-bold text-white mb-2 text-center">Get a Wallet</h2>
            <p className="text-sm text-white/60 mb-6 text-center">
              Download one of these wallets to connect to Xessex
            </p>

            <div className="space-y-3">
              {WALLETS.map((wallet) => (
                <a
                  key={wallet.name}
                  href={wallet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-xl bg-black/50 border border-white/10 hover:border-cyan-400/50 hover:bg-black/70 transition group"
                >
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
                    <Image
                      src={wallet.logo}
                      alt={wallet.name}
                      width={48}
                      height={48}
                      className="w-10 h-10 object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white group-hover:text-cyan-400 transition">
                      {wallet.name}
                    </div>
                    <div className="text-xs text-white/50">{wallet.description}</div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30 group-hover:text-cyan-400 transition">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
