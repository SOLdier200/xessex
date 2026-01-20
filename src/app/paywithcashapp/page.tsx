"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import TopNav from "../components/TopNav";

export default function PayWithCashAppPage() {
  const [memberCycle, setMemberCycle] = useState<"monthly" | "yearly">("monthly");
  const [diamondCycle, setDiamondCycle] = useState<"monthly" | "yearly">("monthly");
  const [isMember, setIsMember] = useState(false);
  const [diamondBetaModalOpen, setDiamondBetaModalOpen] = useState(false);
  const diamondDisabled = false;

  const memberPlan = memberCycle === "monthly" ? "member_monthly" : "member_yearly";
  const diamondPlan = diamondCycle === "monthly" ? "diamond_monthly" : "diamond_yearly";

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const membership = data?.membership ?? "FREE";
        if (membership === "MEMBER" || membership === "DIAMOND") {
          setIsMember(true);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10">
        <Link href="/signup" className="text-gray-400 hover:text-white mb-6 inline-block">
          &larr; Back to Signup
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold neon-text">Pay with Cash App</h1>
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
              <Image src="/logos/textlogo/member.png" alt="Member" width={974} height={286} priority className="h-[58px] w-auto mx-auto" />

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
                    1 Year
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <span className="text-3xl font-bold text-white">
                  {memberCycle === "monthly" ? "$4" : "$40"}
                </span>
                <span className="text-white/60">/{memberCycle === "monthly" ? "month" : "year"}</span>
              </div>
              {memberCycle === "yearly" && (
                <div className="mt-1 text-emerald-400 text-sm">Save $8/year</div>
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
            </ul>

            <Link
              href={`/paywithcashapp/${memberPlan}`}
              className="mt-6 w-full py-3 rounded-xl bg-sky-500/20 border border-sky-400/50 text-sky-400 font-semibold hover:bg-sky-500/30 transition text-center block"
            >
              {isMember ? "Extend Membership" : "Continue with Cash App"}
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
              <Image src="/logos/textlogo/diamonmember.png" alt="Diamond Member" width={1536} height={282} priority className="h-[62px] w-auto mx-auto" />

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
                    1 Year
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <span className="text-3xl font-bold text-white">
                  {diamondCycle === "monthly" ? "$9" : "$70"}
                </span>
                <span className="text-white/60">/{diamondCycle === "monthly" ? "month" : "year"}</span>
              </div>
              {diamondCycle === "yearly" && (
                <div className="mt-1 text-emerald-400 text-sm">Save $38/year</div>
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
            </ul>

            <div className="mt-4 rounded-xl border-2 border-yellow-400/70 bg-yellow-400/20 p-3 text-xs text-yellow-100 shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-pulse">
              <strong className="text-yellow-300">NOTE:</strong> Diamond Membership is in beta testing. If you want to help beta test it, please email{" "}
              <a href="mailto:admin@xessex.me" className="text-yellow-50 underline hover:text-white font-semibold">
                admin@xessex.me
              </a>
              . Beta testers will be rewarded with free Diamond Memberships for a set amount of time after Mainnet launch.
            </div>

            <button
              onClick={() => setDiamondBetaModalOpen(true)}
              className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-purple-500 text-black font-bold hover:from-yellow-400 hover:to-purple-400 transition shadow-[0_0_20px_rgba(234,179,8,0.3)] text-center block"
            >
              {isMember ? "Upgrade to Diamond" : "Become a Diamond Member"}
            </button>
            {/* Original Diamond Cash App button - restore when ready:
            <Link
              href={`/paywithcashapp/${diamondPlan}`}
              className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-purple-500 text-black font-bold hover:from-yellow-400 hover:to-purple-400 transition shadow-[0_0_20px_rgba(234,179,8,0.3)] text-center block"
            >
              Continue with Cash App
            </Link>
            */}
          </div>
        </div>

        {/* Info Box */}
        <div className="max-w-2xl mx-auto mt-8 neon-border rounded-2xl p-5 bg-black/30">
          <h3 className="text-sm font-semibold text-white mb-3">How Cash App Payment Works</h3>
          <ul className="space-y-2 text-sm text-white/60">
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">1.</span>
              <span>Select your plan and click continue</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">2.</span>
              <span>You&apos;ll receive a unique verification code</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">3.</span>
              <span>Send payment to <strong className="text-green-400">$vape200100</strong> (Jose Valdez) with the code in the note</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">4.</span>
              <span>Full verification will happen after a short time</span>
            </li>
          </ul>
        </div>

        <p className="text-center mt-6 text-white/50 text-sm">
          Prefer crypto?{" "}
          <Link href="/signup" className="text-sky-400 hover:underline">
            Pay with Crypto
          </Link>
        </p>
      </div>

      {/* Diamond Beta Testing Modal */}
      {diamondBetaModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setDiamondBetaModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl neon-border bg-gradient-to-b from-yellow-500/10 to-purple-500/10 border-yellow-400/50 p-6">
            <button
              type="button"
              onClick={() => setDiamondBetaModalOpen(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 border border-yellow-400/50 flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">💎</span>
              </div>
              <h2 className="text-xl font-bold text-yellow-300">Diamond Membership Beta</h2>
            </div>

            <div className="text-white/80 text-sm space-y-3">
              <p>
                Although Diamond Membership is not fully ready, we are beta testing it now!
              </p>
              <p>
                If you email{" "}
                <a href="mailto:admin@xessex.me" className="text-yellow-300 underline hover:text-yellow-200 font-semibold">
                  admin@xessex.me
                </a>
                {" "}we can likely extend you a temporary Diamond Membership for testing, along with a free Diamond Membership for a certain amount of time after launching on Mainnet!
              </p>
              <p className="text-yellow-200 font-semibold">
                Because we are going to be paying out 1 Million Xess Tokens per week to our Diamond Members, the first to sign up after Mainnet launch are going to be receiving very large sums of tokens! Especially if you rank well on the Diamond Ladder!
              </p>
              <p>
                Your email response will have all the details on what we need for testing — it&apos;s actually extremely simple.
              </p>
            </div>

            <a
              href="mailto:admin@xessex.me?subject=Diamond%20Membership%20Beta%20Testing"
              className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-purple-500 text-black font-bold hover:from-yellow-400 hover:to-purple-400 transition shadow-[0_0_20px_rgba(234,179,8,0.3)] text-center block"
            >
              Email Us to Join Beta
            </a>

            <button
              onClick={() => setDiamondBetaModalOpen(false)}
              className="mt-3 w-full py-2 text-white/60 hover:text-white text-sm transition"
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
