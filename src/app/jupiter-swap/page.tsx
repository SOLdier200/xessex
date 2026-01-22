import Link from "next/link";

export const metadata = {
  title: "Jupiter Swap | Xessex",
  description: "Swap XESS tokens on Jupiter Exchange",
};

export default function JupiterSwapPage() {
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

        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
          Jupiter Swap
        </h1>

        <p className="text-white/60 mb-8">
          Swap tokens using Jupiter, Solana&apos;s leading DEX aggregator.
        </p>

        <div className="space-y-8">
          <section className="bg-gray-900/50 border border-orange-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-orange-300">Quick Swap</h2>
            <p className="text-white/70 mb-6">
              Jupiter aggregates liquidity across multiple DEXes to find you the best swap rates.
              Once XESS is live, you&apos;ll be able to swap directly here.
            </p>
            <div className="bg-black/30 rounded-xl p-6 text-center">
              <p className="text-white/50 mb-4">Jupiter swap widget will appear here once XESS launches</p>
              <button
                disabled
                className="px-6 py-3 rounded-xl bg-orange-500/20 border border-orange-400/40 text-orange-300 font-semibold opacity-50 cursor-not-allowed"
              >
                Swap Coming Soon
              </button>
            </div>
          </section>

          <section className="bg-gray-900/50 border border-amber-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-amber-300">Why Jupiter?</h2>
            <ul className="space-y-3 text-white/70">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">•</span>
                <span><strong>Best Rates:</strong> Jupiter scans all DEXes to find optimal swap routes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">•</span>
                <span><strong>Low Slippage:</strong> Smart routing minimizes price impact</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">•</span>
                <span><strong>Trusted:</strong> Most used swap aggregator on Solana</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">•</span>
                <span><strong>Fast:</strong> Transactions confirm in seconds</span>
              </li>
            </ul>
          </section>

          <section className="bg-gray-900/50 border border-yellow-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-yellow-300">How to Swap</h2>
            <ol className="space-y-3 text-white/70">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/30 flex items-center justify-center text-sm font-semibold text-yellow-300">1</span>
                <span>Connect your Solana wallet (Phantom, Solflare, etc.)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/30 flex items-center justify-center text-sm font-semibold text-yellow-300">2</span>
                <span>Select the token you want to swap from (e.g., SOL)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/30 flex items-center justify-center text-sm font-semibold text-yellow-300">3</span>
                <span>Select XESS as the token you want to receive</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/30 flex items-center justify-center text-sm font-semibold text-yellow-300">4</span>
                <span>Enter the amount and confirm the transaction</span>
              </li>
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}
