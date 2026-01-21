"use client";

import Link from "next/link";
import Image from "next/image";
import TopNav from "../components/TopNav";

export default function RewardsPage() {
  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="mx-auto max-w-4xl px-5 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block mb-6">
            <Image
              src="/logos/neonmainlogo1.png"
              alt="Xessex"
              width={285}
              height={95}
              className="h-[60px] md:h-[80px] w-auto mx-auto"
              priority
            />
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold neon-text mb-4">
            Earn XESS Rewards
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Multiple ways to earn crypto on Xessex. Diamond members earn weekly payouts
            in XESS tokens for their activity and engagement.
          </p>
        </div>

        {/* Current Earning Methods */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
            Active Reward Pools
          </h2>

          <div className="grid gap-4">
            {/* Weekly Score Pool */}
            <div className="rounded-2xl border border-purple-400/30 bg-gradient-to-r from-purple-500/10 via-black/30 to-pink-500/10 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-purple-400 mb-2">
                    Weekly Score Pool
                  </h3>
                  <p className="text-white/70 text-sm mb-3">
                    Earn XESS based on the score your comments receive from other members and moderators.
                    Top 50 scorers split the weekly pool.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-400 text-xs">
                      75% of weekly emission
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-white/10 text-white/60 text-xs">
                      Diamond Only
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-purple-400">+5</div>
                  <div className="text-xs text-white/50">per member like</div>
                  <div className="text-xl font-bold text-purple-400 mt-1">+15</div>
                  <div className="text-xs text-white/50">per mod like</div>
                </div>
              </div>
            </div>

            {/* MVM Pool */}
            <div className="rounded-2xl border border-yellow-400/30 bg-gradient-to-r from-yellow-500/10 via-black/30 to-orange-500/10 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-yellow-400 mb-2">
                    Most Valuable Member (MVM)
                  </h3>
                  <p className="text-white/70 text-sm mb-3">
                    When your comment is used to grade a video, you earn MVM points.
                    Monthly rankings determine weekly payouts from the MVM pool.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs">
                      20% of weekly emission
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-white/10 text-white/60 text-xs">
                      Diamond Only
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-yellow-400">+1</div>
                  <div className="text-xs text-white/50">per grade used</div>
                </div>
              </div>
            </div>

            {/* Comments Pool */}
            <div className="rounded-2xl border border-blue-400/30 bg-gradient-to-r from-blue-500/10 via-black/30 to-cyan-500/10 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-blue-400 mb-2">
                    Comment Rewards
                  </h3>
                  <p className="text-white/70 text-sm mb-3">
                    Diamond members earn a share of the comments pool based on how many
                    quality comments they post each week.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-xs">
                      5% of weekly emission
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-white/10 text-white/60 text-xs">
                      Diamond Only
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-400">Pro-rata</div>
                  <div className="text-xs text-white/50">by comment count</div>
                </div>
              </div>
            </div>

            {/* Voter Rewards */}
            <div className="rounded-2xl border border-green-400/30 bg-gradient-to-r from-green-500/10 via-black/30 to-emerald-500/10 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-green-400 mb-2">
                    Voter Rewards
                  </h3>
                  <p className="text-white/70 text-sm mb-3">
                    Vote on comments and help curate quality content. All members with linked
                    wallets earn a share based on votes cast.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs">
                      5% of likes pool
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-white/10 text-white/60 text-xs">
                      All Members
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-400">Pro-rata</div>
                  <div className="text-xs text-white/50">by votes cast</div>
                </div>
              </div>
            </div>

            {/* Referral Rewards */}
            <div className="rounded-2xl border border-pink-400/30 bg-gradient-to-r from-pink-500/10 via-black/30 to-rose-500/10 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-pink-400 mb-2">
                    Referral Program
                  </h3>
                  <p className="text-white/70 text-sm mb-3">
                    Refer Diamond members and earn a percentage of their rewards.
                    Three-tier referral system for passive income.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-lg bg-pink-500/20 text-pink-400 text-xs">
                      L1: 10% | L2: 3% | L3: 1%
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-white/10 text-white/60 text-xs">
                      Diamond Only
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-pink-400">3-Tier</div>
                  <div className="text-xs text-white/50">passive earnings</div>
                </div>
              </div>
            </div>

            {/* All-Time Score */}
            <div className="rounded-2xl border border-indigo-400/30 bg-gradient-to-r from-indigo-500/10 via-black/30 to-violet-500/10 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-indigo-400 mb-2">
                    All-Time Leaderboard
                  </h3>
                  <p className="text-white/70 text-sm mb-3">
                    Top 50 all-time scorers receive a weekly bonus from the all-time pool.
                    Build your reputation and earn rewards forever.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs">
                      10% of likes pool
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-white/10 text-white/60 text-xs">
                      Diamond Only
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-indigo-400">Top 50</div>
                  <div className="text-xs text-white/50">lifetime score</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Emission Schedule */}
        <div className="mb-12 rounded-2xl border border-white/10 bg-black/30 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Weekly Emission Schedule</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-green-400">1M</div>
              <div className="text-xs text-white/50">Weeks 1-12</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-yellow-400">750K</div>
              <div className="text-xs text-white/50">Weeks 13-39</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-orange-400">500K</div>
              <div className="text-xs text-white/50">Weeks 40-78</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-red-400">250K</div>
              <div className="text-xs text-white/50">Week 79+</div>
            </div>
          </div>
          <p className="text-xs text-white/40 mt-4 text-center">
            XESS tokens distributed weekly to active Diamond members
          </p>
        </div>

        {/* Coming Soon Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            Coming Soon
          </h2>

          <div className="grid gap-4">
            {/* LP Rewards */}
            <div className="rounded-2xl border border-dashed border-cyan-400/40 bg-gradient-to-r from-cyan-500/5 via-black/20 to-blue-500/5 p-6 relative overflow-hidden">
              <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-semibold">
                Coming Soon
              </div>
              <div className="flex items-start">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mr-4 flex-shrink-0">
                  <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-cyan-400 mb-2">
                    SOL/XESS Liquidity Pool Rewards
                  </h3>
                  <p className="text-white/70 text-sm mb-3">
                    Provide liquidity to the SOL/XESS trading pair and earn a share of trading fees
                    plus bonus XESS rewards. Help grow the ecosystem while earning passive income.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs">
                      LP Token Staking
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs">
                      Trading Fees
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs">
                      Bonus XESS
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Vault Staking */}
            <div className="rounded-2xl border border-dashed border-amber-400/40 bg-gradient-to-r from-amber-500/5 via-black/20 to-yellow-500/5 p-6 relative overflow-hidden">
              <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold">
                Coming Soon
              </div>
              <div className="flex items-start">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mr-4 flex-shrink-0">
                  <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-amber-400 mb-2">
                    XESS Vault Staking
                  </h3>
                  <p className="text-white/70 text-sm mb-3">
                    Lock your XESS tokens in the vault for fixed periods and earn boosted rewards.
                    Longer lock periods earn higher APY. Reduce circulating supply while earning.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs">
                      30/90/180/365 Day Locks
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs">
                      Tiered APY
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs">
                      Auto-Compound
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Holder Drip */}
            <div className="rounded-2xl border border-dashed border-emerald-400/40 bg-gradient-to-r from-emerald-500/5 via-black/20 to-green-500/5 p-6 relative overflow-hidden">
              <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                Coming Soon
              </div>
              <div className="flex items-start">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mr-4 flex-shrink-0">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-emerald-400 mb-2">
                    Holder Drip Rewards
                  </h3>
                  <p className="text-white/70 text-sm mb-3">
                    Simply hold XESS in your wallet and receive a constant drip of additional tokens.
                    The more you hold, the more you earn. No staking required - just HODL.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs">
                      Passive Income
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs">
                      No Lock Required
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs">
                      Daily Snapshots
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How to Get Started */}
        <div className="mb-12 rounded-2xl border border-white/10 bg-black/30 p-6">
          <h2 className="text-xl font-semibold text-white mb-6">How to Start Earning</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-pink-400 font-bold text-xl">1</span>
              </div>
              <h3 className="text-white font-semibold mb-1">Sign Up</h3>
              <p className="text-white/50 text-sm">Create a free account or connect your wallet</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-pink-400 font-bold text-xl">2</span>
              </div>
              <h3 className="text-white font-semibold mb-1">Go Diamond</h3>
              <p className="text-white/50 text-sm">Upgrade to Diamond for full earning potential</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-pink-400 font-bold text-xl">3</span>
              </div>
              <h3 className="text-white font-semibold mb-1">Link Wallet</h3>
              <p className="text-white/50 text-sm">Connect a Solana wallet for payouts</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-pink-400 font-bold text-xl">4</span>
              </div>
              <h3 className="text-white font-semibold mb-1">Engage & Earn</h3>
              <p className="text-white/50 text-sm">Comment, vote, and earn weekly payouts</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 px-8 py-4 font-semibold text-white hover:from-pink-400 hover:to-purple-400 transition text-lg"
            >
              Start Earning Now
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-xl border border-white/20 bg-white/5 px-8 py-4 font-semibold text-white/80 hover:bg-white/10 transition text-lg"
            >
              View Leaderboard
            </Link>
          </div>
          <p className="text-white/40 text-sm mt-4">
            Weekly payouts every Monday at 00:00 UTC
          </p>
        </div>
      </div>
    </main>
  );
}
