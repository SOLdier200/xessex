import Link from "next/link";
import Image from "next/image";
import TopNav from "../components/TopNav";

export const metadata = {
  title: "Xess News | Xessex",
  description: "Latest updates and announcements about XESS",
};

export default function XessNewsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <TopNav />
      <div className="max-w-4xl mx-auto px-4 py-12">
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
          {/* Private Sale Live + TGE Update */}
          <article className="bg-gradient-to-br from-pink-900/40 to-purple-900/30 border-2 border-pink-400/50 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-400/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-1 text-xs font-bold bg-pink-500/30 text-pink-300 rounded-full uppercase tracking-wide">
                  Major Update
                </span>
                <span className="text-sm text-pink-400/70">February 2026</span>
              </div>
              <h2 className="text-2xl font-bold mb-3 text-white">Private XESS Token Sale Is Live!</h2>
              <div className="space-y-3 text-white/80">
                <p>
                  The <Link href="/launch" className="text-pink-300 font-semibold hover:underline">Private XESS Token Sale</Link> is
                  now live on Solana Mainnet via our Token Launch page. You can purchase XESS tokens directly — all tokens purchased
                  will be <span className="text-pink-300 font-semibold">instantly deposited into your wallet</span>, although they
                  will not be tradeable until TGE (Token Generation Event).
                </p>
                <p>
                  <span className="text-pink-300 font-semibold">Core Platform Complete:</span> The core of Xessex is complete. Although
                  we are still in Devnet testing, everything appears to be working. We are now onboarding users to test the site at
                  scale during the private sale as we prepare to go fully live on Mainnet.
                </p>
                <p>
                  <span className="text-pink-300 font-semibold">TGE Target: April 12th, 2026.</span> At TGE, all comments will be
                  cleared, ratings will be reset, and Mainnet operations will begin. This is the day Xessex goes fully live.
                </p>
                <p>
                  <span className="text-pink-300 font-semibold">Payout Systems Online:</span> Both the
                  Credits payout system and the XESS Token payout system are fully online and functioning. Users are earning
                  rewards right now.
                </p>
                <p>
                  <span className="text-pink-300 font-semibold">New Features:</span>
                </p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li><span className="text-pink-300">Playlist Feature</span> — Create playlists of your favorite videos for easy access.</li>
                  <li><span className="text-pink-300">Messages System</span> — Now live. The system can send messages to users, and users can interact with each other.</li>
                  <li><span className="text-pink-300">Content Moderation</span> — An active moderation system watches for comments that violate our policies. Violations are taken down immediately. (<Link href="/terms" className="text-pink-300 hover:underline">See Terms of Service</Link>)</li>
                </ul>
                <p>
                  <span className="text-pink-300 font-semibold">Tier Matters:</span> Your tier determines the rate at which you
                  accumulate Special Credits, which are needed for video unlocks to reach the large XESS token payouts. Until those
                  large payouts on Xessex content are reached, all those hundreds of thousands of tokens per week will be burned —
                  fully documented on the <Link href="/burned" className="text-pink-300 hover:underline">Burn Page</Link>.
                </p>
                <Link
                  href="/launch"
                  className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-pink-500/20 border border-pink-400/50 text-pink-300 font-semibold hover:bg-pink-500/30 transition"
                >
                  Go to Token Launch
                  <span>→</span>
                </Link>
              </div>
            </div>
          </article>

          {/* Xessex Goes Free Announcement */}
          <article className="bg-gradient-to-br from-cyan-900/40 to-blue-900/30 border-2 border-cyan-400/50 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-1 text-xs font-bold bg-cyan-500/30 text-cyan-300 rounded-full uppercase tracking-wide">
                  Major Update
                </span>
                <span className="text-sm text-cyan-400/70">January 2026</span>
              </div>
              <h2 className="text-2xl font-bold mb-3 text-white">Xessex Is Now Free For Everyone!</h2>
              <div className="space-y-3 text-white/80">
                <p>
                  We&apos;ve completely redesigned how Xessex works. <span className="text-cyan-300 font-semibold">No more memberships. No more subscriptions. No more paywalls.</span> Xessex is now 100% free to join and use.
                </p>
                <p>
                  <span className="text-cyan-300 font-semibold">How It Works Now:</span>
                </p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li><span className="text-cyan-300">Connect your wallet</span> — That&apos;s it. You&apos;re in. No email, no password, no payment.</li>
                  <li><span className="text-cyan-300">Unlock videos with Special Credits</span> — Hold XESS tokens in your wallet to earn daily Special Credits automatically.</li>
                  <li><span className="text-cyan-300">Progressive unlock costs</span> — Your first unlocks are cheaper. The more you unlock, the more it costs (encouraging exploration).</li>
                  <li><span className="text-cyan-300">Earn XESS rewards</span> — Like comments, engage with content, and earn XESS tokens every week.</li>
                </ul>
                <p className="mt-4">
                  <span className="text-cyan-300 font-semibold">Special Credits Tiers:</span> The more XESS you hold, the more credits you earn daily:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-sm">
                  <div className="bg-black/30 rounded-lg p-2 text-center">
                    <div className="text-cyan-300 font-bold">10K XESS</div>
                    <div className="text-white/60">160/month</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-2 text-center">
                    <div className="text-cyan-300 font-bold">25K XESS</div>
                    <div className="text-white/60">480/month</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-2 text-center">
                    <div className="text-cyan-300 font-bold">50K XESS</div>
                    <div className="text-white/60">960/month</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-2 text-center">
                    <div className="text-cyan-300 font-bold">100K XESS</div>
                    <div className="text-white/60">3,200/month</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-2 text-center">
                    <div className="text-cyan-300 font-bold">250K XESS</div>
                    <div className="text-white/60">8,000/month</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-2 text-center">
                    <div className="text-cyan-300 font-bold">500K XESS</div>
                    <div className="text-white/60">16,000/month</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-2 text-center">
                    <div className="text-cyan-300 font-bold">1M XESS</div>
                    <div className="text-white/60">32,000/month</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-2 text-center">
                    <div className="text-cyan-300 font-bold">2.5M XESS</div>
                    <div className="text-white/60">48,000/month</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-2 text-center">
                    <div className="text-cyan-300 font-bold">5M XESS</div>
                    <div className="text-white/60">64,000/month</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-2 text-center">
                    <div className="text-cyan-300 font-bold">10M XESS</div>
                    <div className="text-white/60">80,000/month</div>
                  </div>
                </div>
                <p className="mt-4 text-white/60 text-sm">
                  This new model aligns incentives: hold XESS, earn credits, unlock content, engage to earn more XESS. A true circular economy powered by the community.
                </p>
              </div>
            </div>
          </article>

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
                  <span className="text-green-300 font-semibold"> ICO Presale</span> with <span className="text-green-300 font-semibold">35% of the total supply</span> available.
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
                  <span className="text-yellow-300 font-semibold">How it works:</span> Each week, users
                  are entered into the rewards pools based on their activity. The drawing wheel shows the distribution
                  breakdown, and you can see exactly how much XESS is allocated to each category.
                </p>
                <p>
                  <span className="text-yellow-300 font-semibold">New Content Database:</span> We&apos;re also expanding
                  our content library! A new database has been added as we actively search the web to find and curate
                  high-quality content for our users. More videos means more opportunities to earn XESS rewards.
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
              The weekly rewards distribution system is now fully operational on Devnet. All users
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

        </div>
      </div>
    </main>
  );
}
