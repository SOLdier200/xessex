import Link from "next/link";
import Image from "next/image";
import TopNav from "../components/TopNav";

export const metadata = {
  title: "Swap XESS | Xessex",
  description: "Swap XESS tokens on Solana DEXes - Orca, Raydium, and Jupiter",
};

export default function SwapPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <TopNav />
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-12">
        <h1 className="text-2xl sm:text-4xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          Swap XESS
        </h1>

        <p className="text-white/60 text-sm sm:text-base mb-6 sm:mb-8">
          Trade XESS tokens on Solana&apos;s top decentralized exchanges.
        </p>

        <div className="space-y-4 sm:space-y-6">
          {/* Orca Pool */}
          <section className="bg-gray-900/50 border border-cyan-500/30 rounded-2xl p-4 sm:p-6 overflow-hidden">
            <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
              <Image
                src="/logos/orca.jpg"
                alt="Orca"
                width={40}
                height={40}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0"
              />
              <h2 className="text-xl sm:text-2xl font-semibold text-cyan-300">Orca</h2>
            </div>
            <p className="text-white/70 text-sm sm:text-base mb-3 sm:mb-4">
              Swap on Orca&apos;s concentrated liquidity pools for optimal rates and low slippage.
            </p>
            <a
              href="https://www.orca.so/pools?tokens=So11111111111111111111111111111111111111112&tokens=DYW4Q416BWgwrjLFvr3uVB9HDddkzzGj1RquerMkbZBu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 sm:px-6 py-3 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-400 text-sm sm:text-base font-semibold hover:bg-cyan-500/30 transition"
            >
              Open Orca Pool
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </section>

          {/* Raydium Pool */}
          <section className="bg-gray-900/50 border border-purple-500/30 rounded-2xl p-4 sm:p-6 overflow-hidden">
            <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
              <Image
                src="/logos/ray.png"
                alt="Raydium"
                width={40}
                height={40}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0"
              />
              <h2 className="text-xl sm:text-2xl font-semibold text-purple-300">Raydium</h2>
            </div>
            <p className="text-white/70 text-sm sm:text-base mb-3 sm:mb-4">
              Trade on Raydium&apos;s AMM pools with deep liquidity and fast execution.
            </p>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:gap-3">
              <a
                href="https://raydium.io/swap/?inputMint=sol&outputMint=DYW4Q416BWgwrjLFvr3uVB9HDddkzzGj1RquerMkbZBu"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl bg-purple-500/20 border border-purple-400/50 text-purple-400 text-sm sm:text-base font-semibold hover:bg-purple-500/30 transition"
              >
                Buy XESS (SOL → XESS)
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
              <a
                href="https://raydium.io/swap/?inputMint=DYW4Q416BWgwrjLFvr3uVB9HDddkzzGj1RquerMkbZBu&outputMint=sol"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl bg-purple-500/20 border border-purple-400/50 text-purple-400 text-sm sm:text-base font-semibold hover:bg-purple-500/30 transition"
              >
                Sell XESS (XESS → SOL)
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
              <a
                href="https://raydium.io/clmm/create-position/?pool_id=2oWAH92yRBbLgxs1VUhkV6BFwfsFfpDZ82DKeYktYUCW"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl bg-purple-500/10 border border-purple-400/30 text-purple-300 text-sm sm:text-base font-semibold hover:bg-purple-500/20 transition"
              >
                Raydium Pool (Devnet)
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </section>

          {/* XESS Token Info */}
          <section className="bg-gray-900/50 border border-white/10 rounded-2xl p-4 sm:p-6 overflow-hidden">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-white/90">XESS Token</h2>
            <div className="space-y-2 text-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-white/10 gap-1">
                <span className="text-white/60 flex-shrink-0">Token Address</span>
                <code className="text-[11px] sm:text-xs bg-black/30 px-2 py-1 rounded font-mono text-white/80 break-all">
                  DYW4Q416BWgwrjLFvr3uVB9HDddkzzGj1RquerMkbZBu
                </code>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-white/60">Network</span>
                <span className="text-white/80">Solana Devnet</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-white/60">Decimals</span>
                <span className="text-white/80">9</span>
              </div>
            </div>
          </section>

          {/* How to Swap */}
          <section className="bg-gray-900/50 border border-yellow-500/30 rounded-2xl p-4 sm:p-6 overflow-hidden">
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-yellow-300">How to Swap</h2>
            <ol className="space-y-3 text-sm sm:text-base text-white/70">
              <li className="flex gap-2.5 sm:gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/30 flex items-center justify-center text-sm font-semibold text-yellow-300">1</span>
                <span>Connect your Solana wallet (Phantom, Solflare, Backpack)</span>
              </li>
              <li className="flex gap-2.5 sm:gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/30 flex items-center justify-center text-sm font-semibold text-yellow-300">2</span>
                <span>Choose your preferred DEX above (Orca, Raydium, or Jupiter)</span>
              </li>
              <li className="flex gap-2.5 sm:gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/30 flex items-center justify-center text-sm font-semibold text-yellow-300">3</span>
                <span>Enter the amount of SOL or XESS you want to swap</span>
              </li>
              <li className="flex gap-2.5 sm:gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/30 flex items-center justify-center text-sm font-semibold text-yellow-300">4</span>
                <span>Review the rate and confirm the transaction in your wallet</span>
              </li>
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}
