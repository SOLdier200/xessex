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
          <Image
            src="/logos/textlogo/siteset3/rewards2020.png"
            alt="Rewards"
            width={400}
            height={100}
            className="mx-auto mb-4"
          />
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Multiple ways to earn crypto on Xessex. Active users earn weekly payouts
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
                    Earn XESS based on the score your comments receive from other users and moderators.
                    Top 50 scorers split the weekly pool.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-400 text-xs">
                      85% of likes pool
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-white/10 text-white/60 text-xs">
                      All Users
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-purple-400">+5</div>
                  <div className="text-xs text-white/50">per user like</div>
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
                      All Users
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
                    Users earn a share of the comments pool based on how many
                    quality comments they post each week.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-xs">
                      5% of weekly emission
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-white/10 text-white/60 text-xs">
                      All Users
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
                    Vote on comments and help curate quality content. All users
                    earn a share based on votes cast.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs">
                      5% of likes pool
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-white/10 text-white/60 text-xs">
                      All Users
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
                    Refer new users and earn a percentage of their rewards.
                    Three-tier referral system for passive income.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-lg bg-pink-500/20 text-pink-400 text-xs">
                      L1: 10% | L2: 3% | L3: 1%
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-white/10 text-white/60 text-xs">
                      All Users
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
                      All Users
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

        {/* Dual Pool System */}
        <div className="mb-12 rounded-2xl border border-gold-400/30 bg-gradient-to-r from-cyan-500/10 via-black/30 to-orange-500/10 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Dual Reward Pool System</h2>
          <p className="text-white/70 text-sm mb-4">
            Xessex rewards are distributed across two separate content pools. Each pool has its own reward allocation based on the type of content being graded.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
              <div className="text-2xl font-bold text-cyan-400">69%</div>
              <div className="text-lg font-semibold text-cyan-300">Xessex Pool</div>
              <div className="text-xs text-white/50 mt-1">Premium Xessex original content</div>
              <div className="text-xs text-white/40 mt-2">Coming soon - rewards activate when Xessex content launches</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
              <div className="text-2xl font-bold text-orange-400">31%</div>
              <div className="text-lg font-semibold text-orange-300">Embeds Pool</div>
              <div className="text-xs text-white/50 mt-1">Embedded video content</div>
              <div className="text-xs text-green-400 mt-2">Active now - earn by grading embed videos</div>
            </div>
          </div>
          <p className="text-xs text-white/40 text-center">
            Unused Xessex pool emissions are burned until premium content launches
          </p>
        </div>

        {/* Pool Distribution */}
        <div className="mb-12 rounded-2xl border border-white/10 bg-black/30 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Weekly Pool Distribution (Per Content Pool)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-purple-400">70%</div>
              <div className="text-xs text-white/50">Likes Pool</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-yellow-400">20%</div>
              <div className="text-xs text-white/50">MVM Pool</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-blue-400">5%</div>
              <div className="text-xs text-white/50">Comments Pool</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-pink-400">5%</div>
              <div className="text-xs text-white/50">Referrals Pool</div>
            </div>
          </div>
          <p className="text-xs text-white/40 mt-4 text-center">
            Likes pool is further split: 85% weekly score, 10% all-time, 5% voters
          </p>
        </div>

        {/* Emission Schedule */}
        <div className="mb-12 rounded-2xl border border-white/10 bg-black/30 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Weekly Emission Schedule</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-green-400">666K</div>
              <div className="text-xs text-white/50">Weeks 1-12</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-yellow-400">500K</div>
              <div className="text-xs text-white/50">Weeks 13-39</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-orange-400">333K</div>
              <div className="text-xs text-white/50">Weeks 40-78</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-red-400">166K</div>
              <div className="text-xs text-white/50">Week 79+</div>
            </div>
          </div>
          <p className="text-xs text-white/40 mt-4 text-center">
            XESS tokens distributed weekly to active users (200M total over time)
          </p>
        </div>

        {/* Special Credits Section */}
        <div
          id="credit-earning-tiers"
          className="mb-12 rounded-2xl border border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 via-black/30 to-blue-500/10 p-6"
        >
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">Special Credits</h2>
          <p className="text-white/70 text-sm mb-4">
            Hold XESS tokens in your wallet and earn Special Credits monthly. Use credits to enter
            the weekly reward drawing for a chance to win big prizes!
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/50 border-b border-white/10">
                  <th className="text-left py-2 px-2">XESS Holdings</th>
                  <th className="text-right py-2 px-2">Credits/Month</th>
                </tr>
              </thead>
              <tbody className="text-white/70">
                <tr className="border-b border-white/5">
                  <td className="py-2 px-2">10,000 XESS</td>
                  <td className="text-right py-2 px-2 text-cyan-400">80</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-2">25,000 XESS</td>
                  <td className="text-right py-2 px-2 text-cyan-400">240</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-2">50,000 XESS</td>
                  <td className="text-right py-2 px-2 text-cyan-400">480</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-2">100,000 XESS</td>
                  <td className="text-right py-2 px-2 text-cyan-400">1,600</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-2">250,000 XESS</td>
                  <td className="text-right py-2 px-2 text-cyan-400">4,000</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-2">500,000 XESS</td>
                  <td className="text-right py-2 px-2 text-cyan-400">8,000</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-2">1,000,000 XESS</td>
                  <td className="text-right py-2 px-2 text-cyan-400">16,000</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-2">2,500,000 XESS</td>
                  <td className="text-right py-2 px-2 text-cyan-400">24,000</td>
                </tr>
                <tr>
                  <td className="py-2 px-2">5,000,000+ XESS</td>
                  <td className="text-right py-2 px-2 text-cyan-400">32,000</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-center">
            <Link
              href="/rewards-drawing"
              className="rounded-lg border border-cyan-400/50 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-400 hover:bg-cyan-500/20 transition"
            >
              View Rewards Drawing
            </Link>
          </div>
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

          </div>
        </div>

        {/* How to Get Started */}
        <div className="mb-12 rounded-2xl border border-white/10 bg-black/30 p-6">
          <h2 className="text-xl font-semibold text-white mb-6">How to Start Earning</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-pink-400 font-bold text-xl">1</span>
              </div>
              <h3 className="text-white font-semibold mb-1">Connect Wallet</h3>
              <p className="text-white/50 text-sm">Sign in with your Solana wallet</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-pink-400 font-bold text-xl">2</span>
              </div>
              <h3 className="text-white font-semibold mb-1">Engage</h3>
              <p className="text-white/50 text-sm">Comment, vote, and interact with content</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-pink-400 font-bold text-xl">3</span>
              </div>
              <h3 className="text-white font-semibold mb-1">Earn Weekly</h3>
              <p className="text-white/50 text-sm">Claim your XESS token rewards</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/login/diamond"
              className="rounded-xl bg-green-500 px-8 py-4 font-bold text-black hover:bg-green-400 transition text-lg shadow-lg shadow-green-500/30"
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
            Weekly payouts every Monday at 7:59 AM PT
          </p>
        </div>
      </div>
    </main>
  );
}
