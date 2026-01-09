"use client";

import { useState } from "react";
import Link from "next/link";
import TopNav from "../components/TopNav";

type Plan = "MM" | "MY" | "DM" | "DY";

const PLANS = {
  MM: { price: "$3", period: "month", label: "Member Monthly" },
  MY: { price: "$30", period: "year", label: "Member Yearly", savings: "Save $6" },
  DM: { price: "$18.50", period: "month", label: "Diamond Monthly" },
  DY: { price: "$185", period: "year", label: "Diamond Yearly", savings: "Save $37" },
};

export default function SignupPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const memberPlan: Plan = billingCycle === "monthly" ? "MM" : "MY";
  const diamondPlan: Plan = billingCycle === "monthly" ? "DM" : "DY";

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10">
        <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
          &larr; Back to Home
        </Link>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold neon-text">Choose Your Membership</h1>
          <p className="mt-2 text-white/70">Select the plan that&apos;s right for you</p>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-black/40 rounded-full p-1 flex gap-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition ${
                billingCycle === "monthly"
                  ? "bg-white/20 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition ${
                billingCycle === "yearly"
                  ? "bg-white/20 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Yearly
              <span className="ml-2 text-emerald-400 text-xs">Save 16%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Member Tier */}
          <div className="neon-border rounded-2xl p-6 bg-black/30 border-sky-400/30 flex flex-col">
            <div className="text-center">
              <span className="text-4xl">&#11088;</span>
              <h2 className="mt-3 text-2xl font-bold text-sky-400">Member</h2>
              <div className="mt-2">
                <span className="text-3xl font-bold text-white">
                  {PLANS[memberPlan].price}
                </span>
                <span className="text-white/60">/{PLANS[memberPlan].period}</span>
              </div>
              {billingCycle === "yearly" && (
                <div className="mt-1 text-emerald-400 text-sm">{PLANS.MY.savings}</div>
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
            {billingCycle === "monthly" && (
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
            <div className="absolute top-3 right-3 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">
              BEST VALUE
            </div>

            <div className="text-center">
              <span className="text-4xl">&#128142;</span>
              <h2 className="mt-3 text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-purple-400">
                Diamond Member
              </h2>
              <div className="mt-2">
                <span className="text-3xl font-bold text-white">
                  {PLANS[diamondPlan].price}
                </span>
                <span className="text-white/60">/{PLANS[diamondPlan].period}</span>
              </div>
              {billingCycle === "yearly" && (
                <div className="mt-1 text-emerald-400 text-sm">{PLANS.DY.savings}</div>
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
