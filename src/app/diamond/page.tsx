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
        {/* Navigation */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-white/60 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Back</span>
          </Link>
          <Link href="/">
            <Image
              src="/logos/mainsitelogo.png"
              alt="Xessex"
              width={120}
              height={40}
              className="h-8 w-auto"
            />
          </Link>
        </div>

        {/* Header with Diamond image */}
        <div className="text-center mb-12">
          <Image
            src="/logos/textlogo/siteset3/diamond100.png"
            alt="Diamond Member"
            width={600}
            height={180}
            className="mx-auto mb-6"
          />
          <h1 className="text-sm md:text-base font-bold bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
            Diamond Membership
          </h1>
          <p className="text-white/60 mt-3 text-lg">
            The ultimate Xessex experience. You get paid to watch others get laid.
          </p>
        </div>

        {/* Diamond Exclusive Perks */}
        <h2 className="text-xl font-bold text-sky-300 mb-4">Diamond <em>Exclusive</em> Features</h2>
        <div className="grid gap-6 md:grid-cols-2 mb-10">
          {/* Perk 1: Star Ratings */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-400/30">
            <div className="text-3xl mb-3">⭐</div>
            <h3 className="text-xl font-semibold text-yellow-300 mb-2">Star Ratings</h3>
            <p className="text-white/70">
              Rate videos with stars and earn from the weekly Likes Pool (75% of rewards).
              Your ratings help curate the best content.
            </p>
          </div>

          {/* Perk 2: Comments */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-400/30">
            <div className="text-3xl mb-3">💬</div>
            <h3 className="text-xl font-semibold text-purple-300 mb-2">Leave Comments</h3>
            <p className="text-white/70">
              Join the conversation. Leave comments on videos and earn from the
              weekly Comments Pool (5% of rewards).
            </p>
          </div>

          {/* Perk 3: MVM Voting */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-400/30">
            <div className="text-3xl mb-3">🏆</div>
            <h3 className="text-xl font-semibold text-emerald-300 mb-2">Most Valued Member</h3>
            <p className="text-white/70">
              Vote for the most valuable community members each week.
              Get recognized and earn from the MVM Pool (20% of rewards).
            </p>
          </div>

          {/* Perk 4: Wallet Identity */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-400/30">
            <div className="text-3xl mb-3">
              <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-indigo-300 mb-2">Wallet-Based Identity</h3>
            <p className="text-white/70">
              Your Solana wallet is your identity. No email required.
              Secure, anonymous, and fully in your control.
            </p>
          </div>
        </div>

        {/* Shared with Members */}
        <h2 className="text-xl font-bold text-emerald-300 mb-4">Also Included (Shared with Members)</h2>
        <div className="grid gap-6 md:grid-cols-2 mb-12">
          {/* Shared 1: Like Comments */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-400/30">
            <div className="text-3xl mb-3">👍</div>
            <h3 className="text-xl font-semibold text-pink-300 mb-2">Like Comments & Earn</h3>
            <p className="text-white/70">
              Vote on comments and earn XESS tokens. Both Members and Diamond
              users can earn from liking comments.
            </p>
          </div>

          {/* Shared 2: Full Library Access */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-sky-500/10 to-cyan-500/10 border border-sky-400/30">
            <div className="text-3xl mb-3">🎬</div>
            <h3 className="text-xl font-semibold text-sky-300 mb-2">Full Video Library</h3>
            <p className="text-white/70">
              Access our complete curated video collection.
              No restrictions, no limits on what you can watch.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold text-lg hover:from-sky-400 hover:to-blue-500 transition shadow-lg shadow-sky-500/25"
          >
            Become a{" "}
            <Image
              src="/logos/textlogo/siteset3/diamond100.png"
              alt="Diamond Member"
              width={100}
              height={30}
              className="h-6 w-auto"
            />
          </Link>
          <p className="text-white/40 text-sm mt-4">
            Starting at $9/month or $70/year
          </p>
        </div>
      </div>
    </main>
  );
}
