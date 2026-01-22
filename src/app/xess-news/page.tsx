import Link from "next/link";

export const metadata = {
  title: "Xess News | Xessex",
  description: "Latest updates and announcements about XESS",
};

export default function XessNewsPage() {
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

        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
          Xess News
        </h1>

        <p className="text-white/60 mb-8">
          Stay updated with the latest announcements and developments.
        </p>

        {/* Featured Link */}
        <Link
          href="/earn-crypto-watching-porn"
          className="block mb-8 p-4 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/40 hover:border-green-400/70 transition"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <h3 className="font-semibold text-green-300">Earn Crypto Watching Porn</h3>
              <p className="text-sm text-white/60">Learn how to get paid in XESS tokens</p>
            </div>
            <span className="ml-auto text-green-400">→</span>
          </div>
        </Link>

        <div className="space-y-6">
          {/* Placeholder news items */}
          <article className="bg-gray-900/50 border border-pink-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-1 text-xs font-semibold bg-pink-500/20 text-pink-300 rounded-full">
                Announcement
              </span>
              <span className="text-sm text-white/50">Coming Soon</span>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">XESS Token Launch</h2>
            <p className="text-white/70">
              We&apos;re preparing for the official XESS token launch. Stay tuned for more details
              about the launch date, initial distribution, and how to participate.
            </p>
          </article>

          <article className="bg-gray-900/50 border border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-1 text-xs font-semibold bg-purple-500/20 text-purple-300 rounded-full">
                Feature
              </span>
              <span className="text-sm text-white/50">Coming Soon</span>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">Weekly Rewards Program</h2>
            <p className="text-white/70">
              Diamond members will earn XESS tokens through our weekly rewards program.
              Get rewarded for likes received, MVM points, and referrals.
            </p>
          </article>

          <article className="bg-gray-900/50 border border-blue-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-1 text-xs font-semibold bg-blue-500/20 text-blue-300 rounded-full">
                Update
              </span>
              <span className="text-sm text-white/50">Coming Soon</span>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">Liquidity Pool Launch</h2>
            <p className="text-white/70">
              The SOL/XESS liquidity pool will be available on Raydium, enabling
              seamless trading and swapping of XESS tokens.
            </p>
          </article>

          <div className="text-center py-8">
            <p className="text-white/50">More news coming soon...</p>
          </div>
        </div>
      </div>
    </main>
  );
}
