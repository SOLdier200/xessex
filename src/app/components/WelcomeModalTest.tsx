"use client";

import { useState } from "react";

export default function WelcomeModalTest() {
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-b from-black via-black/95 to-pink-950/30 border border-pink-500/40 rounded-2xl p-6 max-w-lg mx-auto shadow-[0_0_40px_rgba(236,72,153,0.3)]">
            <div className="text-center mb-4">
              <span className="text-4xl">🎉</span>
            </div>
            <h3 className="text-2xl font-bold text-white text-center mb-4">
              Welcome to Xessex!
            </h3>
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
