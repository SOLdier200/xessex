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

        <div className="mt-12 flex flex-col items-center justify-center text-center">
          <div className="text-6xl mb-6">🌊</div>
          <p className="text-2xl text-white/80 font-medium">
            Link to Orca Devnet Pool coming very soon...
          </p>
        </div>
      </div>
    </main>
  );
}
