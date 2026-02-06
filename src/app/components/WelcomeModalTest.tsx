"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import Image from "next/image";

export default function WelcomeModalTest() {
  const wallet = useWallet();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowWelcomeModal(true)}
        className="fixed bottom-4 right-4 z-40 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-lg transition"
      >
        Test Welcome Modal
      </button>

      {showWelcomeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowWelcomeModal(false)}
        >
          <div
            className="bg-gradient-to-b from-black via-black/95 to-pink-950/30 border border-pink-500/40 rounded-2xl p-6 max-w-lg mx-auto shadow-[0_0_40px_rgba(236,72,153,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <Image src="/logos/mainsitelogo.png" alt="Xessex" width={260} height={78} className="h-[65px] w-auto" />
            </div>
            <h3 className="text-2xl font-bold text-white text-center mb-2">
              Welcome to Xessex!
            </h3>
            {wallet.publicKey && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(wallet.publicKey!.toBase58());
                  toast.success("Wallet Address Copied!");
                }}
                className="mx-auto mb-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-pink-500/30 transition cursor-pointer group"
                title="Click to copy address"
              >
                <span className="text-white/50 text-xs font-mono break-all">
                  {wallet.publicKey.toBase58()}
                </span>
                <svg className="w-3 h-3 text-white/30 group-hover:text-pink-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            <p className="text-white/80 text-sm leading-relaxed mb-4">
              If you&apos;re tired of trying to watch adult content and having to go through a dozen videos to find one decent one, you&apos;ve found your new source for porn!
            </p>
            <p className="text-white/80 text-sm leading-relaxed mb-4">
              We are literally made to solve that problem. All our videos are great quality, and on top of that we have a <span className="text-pink-400 font-semibold">Ranking system that pays YOU</span> for your valuable opinions.
            </p>
            <p className="text-white/80 text-sm leading-relaxed mb-6">
              Unlock more videos with the credits you earn and help us build a legendary organized porn list where we aim to discover the hottest video on the web!
            </p>
            <button
              onClick={() => setShowWelcomeModal(false)}
              className="w-full py-3 px-6 rounded-xl font-semibold text-white transition bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400"
            >
              Let&apos;s Go!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
