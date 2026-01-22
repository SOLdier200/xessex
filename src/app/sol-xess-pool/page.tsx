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

        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-green-500/10 p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl">🌊</div>
              <div>
                <h2 className="text-xl font-bold text-emerald-400">Orca Pool for Devnet XESS</h2>
                <p className="text-white/60 text-sm">Trade SOL/XESS on Orca (Devnet)</p>
              </div>
            </div>
            <a
              href="https://www.orca.so/pools?chainId=solanaDevnet&tokens=So11111111111111111111111111111111111111112&tokens=DYW4Q416BWgwrjLFvr3uVB9HDddkzzGj1RquerMkbZBu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 font-semibold hover:bg-emerald-500/30 transition"
            >
              Open Orca Pool
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>

          <div className="rounded-2xl border border-yellow-500/30 bg-yellow-900/10 p-4">
            <p className="text-yellow-400 text-sm">
              <strong>Note:</strong> This is the Devnet pool for testing. Mainnet pool will be available after launch.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
