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
          {/* Devnet Launch Announcement */}
          <article className="bg-gradient-to-br from-green-900/40 to-emerald-900/30 border-2 border-green-400/50 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-400/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-1 text-xs font-bold bg-green-500/30 text-green-300 rounded-full uppercase tracking-wide">
                  Milestone
                </span>
                <span className="text-sm text-green-400/70">January 2026</span>
              </div>
              <h2 className="text-2xl font-bold mb-3 text-white">XESS Coin Officially Live on Devnet!</h2>
              <div className="space-y-3 text-white/80">
                <p>
                  We&apos;re thrilled to announce that <span className="text-green-300 font-semibold">XESS Coin is now live on Solana Devnet</span>!
                  Our payout pipeline is complete and fully operational. We&apos;re currently locking in the automatic
                  payment feature as we prepare for the next major milestone.
                </p>
                <p>
                  <span className="text-green-300 font-semibold">Coming Soon:</span> XESS will launch on Mainnet via our
                  <span className="text-green-300 font-semibold"> ICO Presale</span> with <span className="text-green-300 font-semibold">35% of the total supply</span> available
                  — open to the <span className="underline">public ONLY</span>.
                </p>
                <p className="text-lg font-semibold text-green-300 pt-2">
                  We are here for the people, not special interests. This project belongs to the people!
                </p>
              </div>
            </div>
          </article>

          {/* Rewards Drawing & Content DB */}
          <article className="bg-gradient-to-br from-yellow-900/40 to-amber-900/30 border-2 border-yellow-400/50 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-1 text-xs font-bold bg-yellow-500/30 text-yellow-300 rounded-full uppercase tracking-wide">
                  New Feature
                </span>
                <span className="text-sm text-yellow-400/70">January 2026</span>
              </div>
              <h2 className="text-2xl font-bold mb-3 text-white">Rewards Drawing Page Now Live!</h2>
              <div className="space-y-3 text-white/80">
                <p>
                  We&apos;ve launched the <Link href="/rewards-drawing" className="text-yellow-300 font-semibold hover:underline">Rewards Drawing</Link> page
                  — a new way to visualize and track weekly XESS token distributions! The drawing displays an animated
                  wheel showing all reward pools: Likes, MVM, Comments, Referrals, and Voter rewards.
                </p>
                <p>
                  <span className="text-yellow-300 font-semibold">How it works:</span> Each week, Diamond members
                  are entered into the rewards pools based on their activity. The drawing wheel shows the distribution
                  breakdown, and you can see exactly how much XESS is allocated to each category.
                </p>
                <p>
                  <span className="text-yellow-300 font-semibold">New Content Database:</span> We&apos;re also expanding
                  our content library! A new database has been added as we actively search the web to find and curate
                  high-quality content for our members. More videos means more opportunities to earn XESS rewards.
                </p>
                <Link
                  href="/rewards-drawing"
                  className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-yellow-500/20 border border-yellow-400/50 text-yellow-300 font-semibold hover:bg-yellow-500/30 transition"
                >
                  View Rewards Drawing
                  <span>→</span>
                </Link>
              </div>
            </div>
          </article>

          {/* Weekly Rewards - Now Live */}
          <article className="bg-gray-900/50 border border-pink-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-1 text-xs font-semibold bg-pink-500/20 text-pink-300 rounded-full">
                Live
              </span>
              <span className="text-sm text-white/50">January 2026</span>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">Weekly Rewards Pipeline Complete</h2>
            <p className="text-white/70">
              The weekly rewards distribution system is now fully operational on Devnet. Diamond members
              earn XESS tokens through likes received, MVM contributions, comments, and referrals.
              Claim your rewards every week via on-chain merkle proofs.
            </p>
          </article>

          <article className="bg-gray-900/50 border border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-1 text-xs font-semibold bg-purple-500/20 text-purple-300 rounded-full">
                ICO
              </span>
              <span className="text-sm text-white/50">Coming Soon</span>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">ICO Presale - 35% Public Allocation</h2>
            <p className="text-white/70">
              XESS ICO Presale will offer 35% of the total supply exclusively to the public.
              No VCs, no special interest allocations — just a fair launch for the community.
              This is crypto for the people.
            </p>
          </article>

          <article className="bg-gray-900/50 border border-blue-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-1 text-xs font-semibold bg-blue-500/20 text-blue-300 rounded-full">
                Roadmap
              </span>
              <span className="text-sm text-white/50">Coming Soon</span>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">Mainnet Launch</h2>
            <p className="text-white/70">
              After final testing on Devnet, XESS will deploy to Solana Mainnet. The automatic
              payment feature will enable seamless weekly reward distributions directly to your wallet.
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
