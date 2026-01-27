import Link from "next/link";

export const metadata = {
  title: "Swap XESS | Xessex",
  description: "Swap XESS tokens on Solana DEXes - Orca, Raydium, and Jupiter",
};

export default function SwapPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-8 transition"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          Swap XESS
        </h1>

        <p className="text-white/60 mb-8">
          Trade XESS tokens on Solana&apos;s top decentralized exchanges.
        </p>

        <div className="space-y-6">
          {/* Orca Pool */}
          <section className="bg-gray-900/50 border border-cyan-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <span className="text-2xl">🐋</span>
              </div>
              <h2 className="text-2xl font-semibold text-cyan-300">Orca</h2>
            </div>
            <p className="text-white/70 mb-4">
              Swap on Orca&apos;s concentrated liquidity pools for optimal rates and low slippage.
            </p>
            <a
              href="https://www.orca.so/pools?tokens=So11111111111111111111111111111111111111112&tokens=DYW4Q416BWgwrjLFvr3uVB9HDddkzzGj1RquerMkbZBu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-400 font-semibold hover:bg-cyan-500/30 transition"
            >
              Open Orca Pool
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </section>

          {/* Raydium Pool */}
          <section className="bg-gray-900/50 border border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <span className="text-2xl">⚡</span>
              </div>
              <h2 className="text-2xl font-semibold text-purple-300">Raydium</h2>
            </div>
            <p className="text-white/70 mb-4">
              Trade on Raydium&apos;s AMM pools with deep liquidity and fast execution.
            </p>
            <a
              href="https://raydium.io/swap/?inputMint=sol&outputMint=DYW4Q416BWgwrjLFvr3uVB9HDddkzzGj1RquerMkbZBu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-500/20 border border-purple-400/50 text-purple-400 font-semibold hover:bg-purple-500/30 transition"
            >
              Open Raydium Swap
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </section>

          {/* Jupiter Aggregator */}
          <section className="bg-gray-900/50 border border-orange-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <span className="text-2xl">🪐</span>
              </div>
              <h2 className="text-2xl font-semibold text-orange-300">Jupiter</h2>
            </div>
            <p className="text-white/70 mb-4">
              Jupiter aggregates all DEXes to find you the best swap rates across Solana.
            </p>
            <a
              href="https://jup.ag/swap/SOL-DYW4Q416BWgwrjLFvr3uVB9HDddkzzGj1RquerMkbZBu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500/20 border border-orange-400/50 text-orange-400 font-semibold hover:bg-orange-500/30 transition"
            >
              Open Jupiter Swap
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </section>

          {/* XESS Token Info */}
          <section className="bg-gray-900/50 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-white/90">XESS Token</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-white/60">Token Address</span>
                <code className="text-xs bg-black/30 px-2 py-1 rounded font-mono text-white/80">
                  DYW4Q416BWgwrjLFvr3uVB9HDddkzzGj1RquerMkbZBu
                </code>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-white/60">Network</span>
                <span className="text-white/80">Solana Mainnet</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-white/60">Decimals</span>
                <span className="text-white/80">9</span>
              </div>
            </div>
          </section>

          {/* How to Swap */}
          <section className="bg-gray-900/50 border border-yellow-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-yellow-300">How to Swap</h2>
            <ol className="space-y-3 text-white/70">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/30 flex items-center justify-center text-sm font-semibold text-yellow-300">1</span>
                <span>Connect your Solana wallet (Phantom, Solflare, Backpack)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/30 flex items-center justify-center text-sm font-semibold text-yellow-300">2</span>
                <span>Choose your preferred DEX above (Orca, Raydium, or Jupiter)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/30 flex items-center justify-center text-sm font-semibold text-yellow-300">3</span>
                <span>Enter the amount of SOL or XESS you want to swap</span>
              </li>
              <li className="flex gap-3">
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
