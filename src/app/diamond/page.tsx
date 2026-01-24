/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Diamond Membership | Xessex",
  description: "Discover all the perks of becoming a Diamond member on Xessex",
};

export default function DiamondPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header with Diamond image */}
        <div className="text-center mb-12">
          <Image
            src="/logos/textlogo/siteset3/diamond100.png"
            alt="Diamond Member"
            width={200}
            height={60}
            className="mx-auto mb-6"
          />
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
            Diamond Membership
          </h1>
          <p className="text-white/60 mt-3 text-lg">
            The ultimate Xessex experience. Get paid to watch.
          </p>
        </div>

        {/* Perks Grid */}
        <div className="grid gap-6 md:grid-cols-2 mb-12">
          {/* Perk 1: Earn XESS Tokens */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-sky-500/10 to-blue-500/10 border border-sky-400/30">
            <div className="text-3xl mb-3">💎</div>
            <h3 className="text-xl font-semibold text-sky-300 mb-2">Earn XESS Tokens</h3>
            <p className="text-white/70">
              Get rewarded with XESS tokens every week for watching and rating videos.
              The more you engage, the more you earn.
            </p>
          </div>

          {/* Perk 2: Star Ratings */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-400/30">
            <div className="text-3xl mb-3">⭐</div>
            <h3 className="text-xl font-semibold text-yellow-300 mb-2">Exclusive Star Ratings</h3>
            <p className="text-white/70">
              Rate videos with stars and earn from the weekly Likes Pool.
              Your ratings help curate the best content.
            </p>
          </div>

          {/* Perk 3: Comments */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-400/30">
            <div className="text-3xl mb-3">💬</div>
            <h3 className="text-xl font-semibold text-purple-300 mb-2">Comment & Discuss</h3>
            <p className="text-white/70">
              Join the conversation. Leave comments on videos and earn from the
              weekly Comments Pool based on engagement.
            </p>
          </div>

          {/* Perk 4: MVM Voting */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-400/30">
            <div className="text-3xl mb-3">🏆</div>
            <h3 className="text-xl font-semibold text-emerald-300 mb-2">Most Valued Member</h3>
            <p className="text-white/70">
              Vote for the most valuable community members each week.
              Get recognized and earn from the MVM Pool.
            </p>
          </div>

          {/* Perk 5: Full Library Access */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-400/30">
            <div className="text-3xl mb-3">🎬</div>
            <h3 className="text-xl font-semibold text-pink-300 mb-2">Full Video Library</h3>
            <p className="text-white/70">
              Access our complete curated video collection.
              No restrictions, no limits on what you can watch.
            </p>
          </div>

          {/* Perk 6: Wallet Identity */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-400/30">
            <div className="text-3xl mb-3">👛</div>
            <h3 className="text-xl font-semibold text-indigo-300 mb-2">Wallet-Based Identity</h3>
            <p className="text-white/70">
              Your Solana wallet is your identity. No email required.
              Secure, anonymous, and fully in your control.
            </p>
          </div>
        </div>

        {/* Weekly Rewards Breakdown */}
        <div className="rounded-xl p-6 bg-gradient-to-r from-sky-500/5 to-blue-500/5 border border-sky-400/20 mb-12">
          <h2 className="text-2xl font-bold text-center text-sky-300 mb-6">Weekly Reward Pools</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg bg-white/5">
              <div className="text-2xl font-bold text-yellow-400">75%</div>
              <div className="text-white/60 text-sm mt-1">Likes Pool</div>
              <div className="text-white/40 text-xs mt-1">Star ratings on videos</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-white/5">
              <div className="text-2xl font-bold text-emerald-400">20%</div>
              <div className="text-white/60 text-sm mt-1">MVM Pool</div>
              <div className="text-white/40 text-xs mt-1">Most Valued Member votes</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-white/5">
              <div className="text-2xl font-bold text-purple-400">5%</div>
              <div className="text-white/60 text-sm mt-1">Comments Pool</div>
              <div className="text-white/40 text-xs mt-1">Engagement on comments</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/signup"
            className="inline-block px-8 py-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold text-lg hover:from-sky-400 hover:to-blue-500 transition shadow-lg shadow-sky-500/25"
          >
            Become a Diamond Member
          </Link>
          <p className="text-white/40 text-sm mt-4">
            Starting at $9/month or $70/year
          </p>
        </div>
      </div>
    </main>
  );
}
