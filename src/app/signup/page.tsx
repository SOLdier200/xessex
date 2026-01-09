"use client";

import { useState } from "react";
import Link from "next/link";
import TopNav from "../components/TopNav";

export default function SignupPage() {
  const [memberCycle, setMemberCycle] = useState<"monthly" | "yearly">("monthly");
  const [diamondCycle, setDiamondCycle] = useState<"monthly" | "yearly">("monthly");

  const memberPlan = memberCycle === "monthly" ? "MM" : "MY";
  const diamondPlan = diamondCycle === "monthly" ? "DM" : "DY";

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10">
        <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
          &larr; Back to Home
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold neon-text">Choose Your Membership</h1>
          <p className="mt-2 text-white/70">Select the plan that&apos;s right for you</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Member Tier */}
          <div className="neon-border rounded-2xl p-6 bg-black/30 border-sky-400/30 flex flex-col relative overflow-hidden">
            {memberCycle === "yearly" && (
              <div className="absolute top-3 right-3 bg-emerald-500 text-black text-xs font-bold px-2 py-1 rounded">
                BEST VALUE
              </div>
            )}

            <div className="text-center">
              <img src="/logos/textlogo/member.png" alt="Member" className="h-[58px] mx-auto" />

              {/* Billing Toggle */}
              <div className="flex justify-center mt-3">
                <div className="bg-black/40 rounded-full p-1 flex gap-1">
                  <button
                    onClick={() => setMemberCycle("monthly")}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                      memberCycle === "monthly"
                        ? "bg-sky-500/30 text-sky-300"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setMemberCycle("yearly")}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                      memberCycle === "yearly"
                        ? "bg-sky-500/30 text-sky-300"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Yearly
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <span className="text-3xl font-bold text-white">
                  {memberCycle === "monthly" ? "$3" : "$30"}
                </span>
                <span className="text-white/60">/{memberCycle === "monthly" ? "month" : "year"}</span>
              </div>
              {memberCycle === "yearly" && (
                <div className="mt-1 text-emerald-400 text-sm">Save $6</div>
              )}
            </div>

            <ul className="mt-6 space-y-3 flex-1">
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">&#10003;</span>
                Full access to all videos
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">&#10003;</span>
                HD streaming quality
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">&#10003;</span>
                Vote on comments
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">&#10003;</span>
                No ads
              </li>
              <li className="flex items-center gap-2 text-white/50">
                <span className="text-red-400">&#10007;</span>
                Earn to Watch (not included)
              </li>
            </ul>

            {/* Stablecoin hint for low-cost monthly */}
            {memberCycle === "monthly" && (
              <div className="mt-4 p-3 bg-sky-500/10 rounded-lg text-xs text-sky-300/80">
                Tip: Stablecoins (USDT/USDC on TRC20/BSC/Polygon) recommended for low-cost plans.
              </div>
            )}

            <Link
              href={`/subscribe?plan=${memberPlan}`}
              className="mt-6 w-full py-3 rounded-xl bg-sky-500/20 border border-sky-400/50 text-sky-400 font-semibold hover:bg-sky-500/30 transition text-center block"
            >
              Become a Member
            </Link>
          </div>

          {/* Diamond Member Tier */}
          <div className="neon-border rounded-2xl p-6 bg-gradient-to-b from-yellow-500/10 to-purple-500/10 border-yellow-400/50 flex flex-col relative overflow-hidden">
            {/* Diamond image positioned to right middle */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
              <img
                src="/logos/diamond3.png"
                alt="Diamond"
                className="w-24 h-24"
              />
            </div>

            {diamondCycle === "yearly" && (
              <div className="absolute top-3 right-3 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded z-10">
                BEST VALUE
              </div>
            )}

            <div className="text-center relative z-10">
              <img src="/logos/textlogo/diamonmember.png" alt="Diamond Member" className="h-[62px] mx-auto" />

              {/* Billing Toggle */}
              <div className="flex justify-center mt-3">
                <div className="bg-black/40 rounded-full p-1 flex gap-1">
                  <button
                    onClick={() => setDiamondCycle("monthly")}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                      diamondCycle === "monthly"
                        ? "bg-yellow-500/30 text-yellow-300"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setDiamondCycle("yearly")}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                      diamondCycle === "yearly"
                        ? "bg-yellow-500/30 text-yellow-300"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Yearly
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <span className="text-3xl font-bold text-white">
                  {diamondCycle === "monthly" ? "$18.50" : "$185"}
                </span>
                <span className="text-white/60">/{diamondCycle === "monthly" ? "month" : "year"}</span>
              </div>
              {diamondCycle === "yearly" && (
                <div className="mt-1 text-emerald-400 text-sm">Save $37</div>
              )}
            </div>

            <ul className="mt-6 space-y-3 flex-1">
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">&#10003;</span>
                Full access to all videos
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">&#10003;</span>
                4K streaming quality
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">&#10003;</span>
                Post &amp; vote on comments
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">&#10003;</span>
                No ads
              </li>
              <li className="flex items-center gap-2 text-white">
                <span className="text-yellow-400">&#10003;</span>
                <span className="text-yellow-400 font-semibold">
                  Earn <span className="text-green-400">$</span> for rating videos
                </span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <span className="text-yellow-400">&#10003;</span>
                <span className="text-yellow-400 font-semibold">Diamond Ladder rankings</span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <span className="text-yellow-400">&#10003;</span>
                <span className="text-yellow-400 font-semibold">Exclusive Diamond badge</span>
              </li>
            </ul>

            <Link
              href={`/subscribe?plan=${diamondPlan}`}
              className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-purple-500 text-black font-bold hover:from-yellow-400 hover:to-purple-400 transition shadow-[0_0_20px_rgba(234,179,8,0.3)] text-center block"
            >
              Become a Diamond Member
            </Link>
          </div>
        </div>

        {/* Payment info */}
        <div className="max-w-2xl mx-auto mt-8 text-center">
          <p className="text-white/50 text-sm">
            Pay with crypto via NOWPayments. We accept BTC, ETH, SOL, USDT, USDC, and 100+ cryptocurrencies.
          </p>
        </div>

        <p className="text-center mt-6 text-white/50 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-sky-400 hover:underline">
            Connect your wallet
          </Link>
        </p>
      </div>
    </main>
  );
}
