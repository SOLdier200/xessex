import Link from "next/link";

export const metadata = {
  title: "SOL/XESS Pool | Xessex",
  description: "View XESS liquidity pool information on Solana",
};

export default function SolXessPoolPage() {
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

        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
          SOL/XESS Liquidity Pool
        </h1>

        <p className="text-white/60 mb-8">
          View and track the SOL/XESS liquidity pool on Solana.
        </p>

        <div className="space-y-8">
          <section className="bg-gray-900/50 border border-green-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-green-300">Pool Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-black/30 rounded-xl p-4">
                <div className="text-sm text-white/50">Total Liquidity</div>
                <div className="text-xl font-semibold">Coming Soon</div>
              </div>
              <div className="bg-black/30 rounded-xl p-4">
                <div className="text-sm text-white/50">24h Volume</div>
                <div className="text-xl font-semibold">Coming Soon</div>
              </div>
              <div className="bg-black/30 rounded-xl p-4">
                <div className="text-sm text-white/50">XESS Price</div>
                <div className="text-xl font-semibold">Coming Soon</div>
              </div>
              <div className="bg-black/30 rounded-xl p-4">
                <div className="text-sm text-white/50">Pool APY</div>
                <div className="text-xl font-semibold">Coming Soon</div>
              </div>
            </div>
          </section>

          <section className="bg-gray-900/50 border border-emerald-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-emerald-300">Pool Information</h2>
            <p className="text-white/70 mb-4">
              The SOL/XESS liquidity pool will be available on Raydium. Pool details and links
              will be published once the token launches.
            </p>
            <button
              disabled
              className="px-6 py-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-semibold opacity-50 cursor-not-allowed"
            >
              View on Raydium (Coming Soon)
            </button>
          </section>

          <section className="bg-gray-900/50 border border-teal-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-teal-300">How to Provide Liquidity</h2>
            <ol className="space-y-3 text-white/70">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-500/30 flex items-center justify-center text-sm font-semibold text-teal-300">1</span>
                <span>Connect your Solana wallet to Raydium</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-500/30 flex items-center justify-center text-sm font-semibold text-teal-300">2</span>
                <span>Navigate to the SOL/XESS pool</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-500/30 flex items-center justify-center text-sm font-semibold text-teal-300">3</span>
                <span>Add equal value of SOL and XESS tokens</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-500/30 flex items-center justify-center text-sm font-semibold text-teal-300">4</span>
                <span>Confirm the transaction and start earning fees</span>
              </li>
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}
