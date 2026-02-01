"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import TopNav from "../components/TopNav";

type RewardEntry = { user: string; xessEarned: string | number };

type LeaderboardData = {
  mvm: { user: string; utilizedComments: number }[];
  karat: { user: string; totalScore: number }[];
  rewards: RewardEntry[];
  xessexRewards: RewardEntry[];
  embedRewards: RewardEntry[];
  referrals: { user: string; referralCount: number }[];
};

function getRankStyle(rank: number): string {
  if (rank === 0)
    return "bg-black/30 border-yellow-400 animate-pulse-gold";
  if (rank === 1)
    return "bg-black/30 border-gray-300 animate-pulse-silver";
  if (rank === 2)
    return "bg-black/30 border-amber-600 animate-pulse-bronze";
  return "bg-black/30 border-white/10";
}

function getRankNumberStyle(rank: number): string {
  if (rank === 0) return "animate-pulse-gold-text text-yellow-400";
  if (rank === 1) return "animate-pulse-silver-text text-gray-300";
  if (rank === 2) return "animate-pulse-bronze-text text-amber-600";
  if (rank >= 3 && rank <= 9) return "animate-pulse-pink-text text-pink-500";
  return "text-white/70";
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "mvm" | "karat" | "rewards" | "xessex" | "embeds" | "referrals"
  >("karat");
  const [isDiamond, setIsDiamond] = useState(false);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((res) => res.json())
      .then((d) => {
        if (d.ok) {
          setData(d);
        }
      })
      .finally(() => setLoading(false));

    // Check if user is Diamond member
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((d) => {
        if (d.ok && d.membership === "DIAMOND") {
          setIsDiamond(true);
        }
      })
      .catch(() => {});
  }, []);

  const tabs = [
    { id: "karat", label: "Karat Kruncher", desc: "Highest Score" },
    { id: "mvm", label: "MVM", desc: "Most Valuable Member" },
    { id: "xessex", label: "Xessex", desc: "XESS Earned from Xessex Content" },
    { id: "embeds", label: "Embeds", desc: "XESS Earned from Embedded Videos" },
    { id: "rewards", label: "All Rewards", desc: "Total XESS Earned (All Pools)" },
    { id: "referrals", label: "Referrals", desc: "Members Referred" },
  ] as const;

  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-4 md:px-6 pb-10">
        <Link
          href="/"
          className="text-gray-400 hover:text-white mb-6 inline-block text-sm"
        >
          ← Back to Home
        </Link>

        {/* Header */}
        <section className="neon-border rounded-2xl p-4 md:p-6 bg-black/30 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className="absolute inset-0 blur-xl scale-150 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(168,85,247,0.35) 0%, rgba(236,72,153,0.2) 50%, transparent 70%)" }}
              />
              <img
                src="/logos/diamond3.png"
                alt="Diamond"
                className="relative w-[70px] h-[70px] md:w-[81px] md:h-[81px] drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]"
              />
            </div>
            <div>
              <Image src="/logos/textlogo/siteset3/diamondladdea.png" alt="Diamond Ladder" width={1308} height={286} priority fetchPriority="high" className="h-[42px] md:h-[52px] w-auto" />
              <p className="mt-1 text-sm md:text-base text-white/70">
                Top ranked Diamond Members
              </p>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-pink-500/80 text-white"
                  : "bg-black/30 text-white/60 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Description */}
        <div className="mb-4 text-sm text-white/50">
          {tabs.find((t) => t.id === activeTab)?.desc}
        </div>

        {/* Leaderboard Table */}
        {loading ? (
          <div className="neon-border rounded-2xl p-8 bg-black/30 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-white/60">Loading leaderboard...</p>
          </div>
        ) : !data ? (
          <div className="neon-border rounded-2xl p-8 bg-black/30 text-center">
            <p className="text-white/60">Failed to load leaderboard</p>
          </div>
        ) : (
          <section className="neon-border rounded-2xl bg-black/30 overflow-hidden">
            <div className="divide-y divide-white/5">
              {activeTab === "mvm" && (
                <>
                  {data.mvm.length === 0 ? (
                    <div className="p-8 text-center text-white/50">
                      No data yet
                    </div>
                  ) : (
                    data.mvm.map((entry, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-4 p-4 ${getRankStyle(
                          idx
                        )} border-l-4 transition hover:bg-white/5`}
                      >
                        <div className={`w-10 text-xl md:text-2xl font-bold text-center ${getRankNumberStyle(idx)}`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-white font-mono text-sm">
                            {entry.user}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-400">
                            {entry.utilizedComments}
                          </div>
                          <div className="text-xs text-white/50">
                            utilized comments
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === "karat" && (
                <>
                  {data.karat.length === 0 ? (
                    <div className="p-8 text-center text-white/50">
                      No data yet
                    </div>
                  ) : (
                    data.karat.map((entry, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-4 p-4 ${getRankStyle(
                          idx
                        )} border-l-4 transition hover:bg-white/5`}
                      >
                        <div className={`w-10 text-xl md:text-2xl font-bold text-center ${getRankNumberStyle(idx)}`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-white font-mono text-sm">
                            {entry.user}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-pink-400">
                            {entry.totalScore}
                          </div>
                          <div className="text-xs text-white/50">
                            Total Score
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === "xessex" && (
                <>
                  {(data.xessexRewards?.length ?? 0) === 0 ? (
                    <div className="p-8 text-center text-white/50">
                      <p>No Xessex rewards data yet</p>
                      <p className="mt-2 text-xs text-white/30">
                        Once Xessex premium content is available and unlocked by users, these rewards will populate.
                      </p>
                    </div>
                  ) : (
                    data.xessexRewards.map((entry, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-4 p-4 ${getRankStyle(
                          idx
                        )} border-l-4 transition hover:bg-white/5`}
                      >
                        <div className={`w-10 text-xl md:text-2xl font-bold text-center ${getRankNumberStyle(idx)}`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-white font-mono text-sm">
                            {entry.user}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-cyan-400">
                            {entry.xessEarned.toLocaleString()} XESS
                          </div>
                          <div className="text-xs text-white/50">from Xessex</div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === "embeds" && (
                <>
                  {(data.embedRewards?.length ?? 0) === 0 ? (
                    <div className="p-8 text-center text-white/50">
                      No embed rewards data yet
                    </div>
                  ) : (
                    data.embedRewards.map((entry, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-4 p-4 ${getRankStyle(
                          idx
                        )} border-l-4 transition hover:bg-white/5`}
                      >
                        <div className={`w-10 text-xl md:text-2xl font-bold text-center ${getRankNumberStyle(idx)}`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-white font-mono text-sm">
                            {entry.user}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-orange-400">
                            {entry.xessEarned.toLocaleString()} XESS
                          </div>
                          <div className="text-xs text-white/50">from Embeds</div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === "rewards" && (
                <>
                  {data.rewards.length === 0 ? (
                    <div className="p-8 text-center text-white/50">
                      No rewards data yet
                    </div>
                  ) : (
                    data.rewards.map((entry, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-4 p-4 ${getRankStyle(
                          idx
                        )} border-l-4 transition hover:bg-white/5`}
                      >
                        <div className={`w-10 text-xl md:text-2xl font-bold text-center ${getRankNumberStyle(idx)}`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-white font-mono text-sm">
                            {entry.user}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-yellow-400">
                            {entry.xessEarned.toLocaleString()} XESS
                          </div>
                          <div className="text-xs text-white/50">total earned</div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === "referrals" && (
                <>
                  {data.referrals.length === 0 ? (
                    <div className="p-8 text-center text-white/50">
                      No referrals data yet
                    </div>
                  ) : (
                    data.referrals.map((entry, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-4 p-4 ${getRankStyle(
                          idx
                        )} border-l-4 transition hover:bg-white/5`}
                      >
                        <div className={`w-10 text-xl md:text-2xl font-bold text-center ${getRankNumberStyle(idx)}`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-white font-mono text-sm">
                            {entry.user}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-purple-400">
                            {entry.referralCount}
                          </div>
                          <div className="text-xs text-white/50">referrals</div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {/* Call to Action (non-Diamond only) */}
        {!isDiamond && (
          <section className="mt-6 neon-border rounded-2xl p-4 md:p-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-center">
            <h3 className="text-lg md:text-xl font-bold text-white">
              Want to climb the Diamond Ladder?
            </h3>
            <p className="mt-2 text-sm md:text-base text-white/70">
              Connect your wallet and start earning{" "}
              <span className="text-green-400 font-bold">XESS</span> for your
              contributions!
            </p>
            <Link
              href="/login/diamond"
              className="inline-block mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-extrabold hover:from-purple-400 hover:to-pink-400 transition shadow-lg"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
            >
              Connect Wallet
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
