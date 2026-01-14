"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import TopNav from "../components/TopNav";

type ProfileData = {
  ok: boolean;
  authed: boolean;
  email: string | null;
  walletAddress: string | null;
  membership: "FREE" | "MEMBER" | "DIAMOND";
  sub: {
    tier: string;
    status: string;
    expiresAt: string | null;
  } | null;
  stats: {
    videosWatched: number;
    accountCreated: string;
  };
};

type AnalyticsData = {
  totals: {
    totalVideos: number;
    totalComments: number;
    totalMemberLikes: number;
    totalMemberDislikes: number;
    totalModLikes: number;
    totalModDislikes: number;
    utilizedComments: number;
    totalXessPaid: number;
    pendingXess: number;
  };
  comments: {
    sourceId: string;
    createdAt: string;
    body: string;
    memberLikes: number;
    memberDislikes: number;
    modLikes: number;
    modDislikes: number;
    utilized: boolean;
    score: number;
  }[];
};

function formatTimeLeft(expiresAt: string | null): string {
  if (!expiresAt) return "N/A";

  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();

  if (diff <= 0) return "Expired";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days} day${days !== 1 ? "s" : ""}, ${hours} hour${hours !== 1 ? "s" : ""}`;
  }
  return `${hours} hour${hours !== 1 ? "s" : ""}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function truncateWallet(address: string | null): string {
  if (!address) return "N/A";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "analytics">("profile");

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((json) => {
        if (!json.ok || !json.authed) {
          router.push("/login");
          return;
        }
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  // Load analytics when tab is switched to analytics
  useEffect(() => {
    if (activeTab === "analytics" && data?.membership === "DIAMOND" && !analyticsData && !analyticsLoading) {
      setAnalyticsLoading(true);
      fetch("/api/analytics")
        .then((res) => res.json())
        .then((json) => {
          if (json.ok) {
            setAnalyticsData(json);
          } else {
            setAnalyticsError(json.error || "Failed to load analytics");
          }
        })
        .catch(() => setAnalyticsError("Failed to load analytics"))
        .finally(() => setAnalyticsLoading(false));
    }
  }, [activeTab, data?.membership, analyticsData, analyticsLoading]);

  if (loading) {
    return (
      <main className="min-h-screen">
        <TopNav />
        <div className="px-6 py-10 text-center text-white/60">Loading...</div>
      </main>
    );
  }

  if (!data) return null;

  const isDiamond = data.membership === "DIAMOND";

  const membershipColors = {
    FREE: "text-white/60 border-white/20 bg-white/5",
    MEMBER: "text-sky-400 border-sky-400/50 bg-sky-500/20",
    DIAMOND: "text-yellow-400 border-yellow-400/50 bg-yellow-500/20",
  };

  const statusColors: Record<string, string> = {
    ACTIVE: "text-emerald-400",
    PENDING: "text-yellow-400",
    EXPIRED: "text-red-400",
    CANCELED: "text-red-400",
    PARTIAL: "text-orange-400",
  };

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10">
        <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
          &larr; Back to Home
        </Link>

        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold neon-text">Your Profile</h1>
            <p className="mt-2 text-white/70">Manage your account and view membership details</p>
          </div>

          {/* Tabs */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-xl border border-white/10 bg-black/40 p-1">
              <button
                onClick={() => setActiveTab("profile")}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition ${
                  activeTab === "profile"
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white"
                }`}
              >
                Profile
              </button>
              {isDiamond && (
                <button
                  onClick={() => setActiveTab("analytics")}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition ${
                    activeTab === "analytics"
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  <span className="text-pink-500">Anal</span>ytics
                </button>
              )}
            </div>
          </div>

          {/* Profile Tab Content */}
          {activeTab === "profile" && (
            <>
              {/* Account Info Card */}
              <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">Account Information</h2>

                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/60">Email</span>
                    <span className="text-white">{data.email || "Not set"}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/60">Wallet</span>
                    <span className="text-white font-mono text-sm">
                      {truncateWallet(data.walletAddress)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/60">Member Since</span>
                    <span className="text-white">{formatDate(data.stats.accountCreated)}</span>
                  </div>
                </div>
              </div>

              {/* Membership Card */}
              <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">Membership</h2>

                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/60">Current Plan</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${membershipColors[data.membership]}`}>
                      {data.membership === "FREE" ? "Free" : data.membership === "MEMBER" ? "Member" : "Diamond"}
                    </span>
                  </div>

                  {data.sub && (
                    <>
                      <div className="flex justify-between items-center py-2 border-b border-white/10">
                        <span className="text-white/60">Status</span>
                        <span className={`font-semibold ${statusColors[data.sub.status] || "text-white"}`}>
                          {data.sub.status}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-white/10">
                        <span className="text-white/60">Time Remaining</span>
                        <span className="text-white">{formatTimeLeft(data.sub.expiresAt)}</span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-white/10">
                        <span className="text-white/60">Expires On</span>
                        <span className="text-white">
                          {data.sub.expiresAt ? formatDate(data.sub.expiresAt) : "N/A"}
                        </span>
                      </div>
                    </>
                  )}

                  {data.membership === "FREE" && (
                    <div className="mt-4 p-4 bg-sky-500/10 border border-sky-400/30 rounded-xl">
                      <p className="text-sm text-sky-300 mb-3">
                        Upgrade to Member to unlock full access to all videos!
                      </p>
                      <Link
                        href="/signup"
                        className="inline-block px-4 py-2 rounded-xl bg-sky-500/20 border border-sky-400/50 text-sky-400 font-semibold hover:bg-sky-500/30 transition text-sm"
                      >
                        View Membership Options
                      </Link>
                    </div>
                  )}

                  {data.sub && data.sub.status === "ACTIVE" && (
                    <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl">
                      <p className="text-sm text-emerald-300">
                        Your membership is active. Enjoy full access to all content!
                      </p>
                    </div>
                  )}

                  {data.sub && data.sub.status === "EXPIRED" && (
                    <div className="mt-4 p-4 bg-red-500/10 border border-red-400/30 rounded-xl">
                      <p className="text-sm text-red-300 mb-3">
                        Your membership has expired. Renew to continue enjoying full access.
                      </p>
                      <Link
                        href="/signup"
                        className="inline-block px-4 py-2 rounded-xl bg-pink-500/20 border border-pink-400/50 text-pink-400 font-semibold hover:bg-pink-500/30 transition text-sm"
                      >
                        Renew Membership
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Card */}
              <div className="neon-border rounded-2xl p-6 bg-black/30">
                <h2 className="text-lg font-semibold text-white mb-4">Activity</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/40 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-white">{data.stats.videosWatched}</div>
                    <div className="text-xs text-white/60 mt-1">Videos Watched</div>
                  </div>
                  <div className="bg-black/40 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-white">
                      {data.sub?.expiresAt ? formatTimeLeft(data.sub.expiresAt).split(",")[0] : "—"}
                    </div>
                    <div className="text-xs text-white/60 mt-1">Days Left</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Analytics Tab Content */}
          {activeTab === "analytics" && isDiamond && (
            <>
              {analyticsLoading && (
                <div className="neon-border rounded-2xl p-8 bg-black/30 text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full mx-auto"></div>
                  <p className="mt-4 text-white/60">Loading analytics...</p>
                </div>
              )}

              {analyticsError && (
                <div className="neon-border rounded-2xl p-8 bg-black/30 text-center">
                  <p className="text-red-400">{analyticsError}</p>
                </div>
              )}

              {analyticsData && (
                <>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="neon-border rounded-xl p-4 bg-black/30">
                      <div className="text-2xl font-bold text-white">
                        {analyticsData.totals.totalComments}
                      </div>
                      <div className="text-xs text-white/60 mt-1">Total Comments</div>
                    </div>

                    <div className="neon-border rounded-xl p-4 bg-black/30 border-green-400/30">
                      <div className="text-2xl font-bold text-green-400">
                        {analyticsData.totals.utilizedComments}
                      </div>
                      <div className="text-xs text-white/60 mt-1">Utilized (MVM)</div>
                    </div>

                    <div className="neon-border rounded-xl p-4 bg-black/30">
                      <div className="text-2xl font-bold text-white">
                        {analyticsData.totals.totalMemberLikes}
                      </div>
                      <div className="text-xs text-white/60 mt-1">Member Likes</div>
                    </div>

                    <div className="neon-border rounded-xl p-4 bg-black/30">
                      <div className="text-2xl font-bold text-white">
                        {analyticsData.totals.totalModLikes}
                      </div>
                      <div className="text-xs text-white/60 mt-1">Mod Likes</div>
                    </div>
                  </div>

                  {/* Rewards Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="neon-border rounded-xl p-4 bg-gradient-to-r from-yellow-500/10 via-black/0 to-yellow-500/5 border-yellow-400/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-yellow-400/80 uppercase tracking-wide">
                            Total XESS Paid
                          </div>
                          <div className="text-2xl font-bold text-yellow-400 mt-1">
                            {analyticsData.totals.totalXessPaid.toLocaleString()} XESS
                          </div>
                        </div>
                        <Image
                          src="/logos/favicon-32x32.png"
                          alt="XESS"
                          width={32}
                          height={32}
                          className="opacity-50"
                        />
                      </div>
                    </div>

                    <div className="neon-border rounded-xl p-4 bg-gradient-to-r from-green-500/10 via-black/0 to-green-500/5 border-green-400/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-green-400/80 uppercase tracking-wide">
                            Pending XESS
                          </div>
                          <div className="text-2xl font-bold text-green-400 mt-1">
                            {analyticsData.totals.pendingXess.toLocaleString()} XESS
                          </div>
                        </div>
                        <Image
                          src="/logos/favicon-32x32.png"
                          alt="XESS"
                          width={32}
                          height={32}
                          className="opacity-50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Comments Table */}
                  <div className="neon-border rounded-2xl p-4 md:p-6 bg-black/30">
                    <h2 className="text-lg font-semibold neon-text mb-4">
                      Your Comments ({analyticsData.comments.length})
                    </h2>

                    {analyticsData.comments.length === 0 ? (
                      <p className="text-white/50 text-center py-8">
                        You haven&apos;t posted any comments yet.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-white/50 border-b border-white/10">
                              <th className="pb-3 font-medium">ID</th>
                              <th className="pb-3 font-medium">Comment</th>
                              <th className="pb-3 font-medium text-center">Score</th>
                              <th className="pb-3 font-medium text-center">Likes</th>
                              <th className="pb-3 font-medium text-center">Status</th>
                              <th className="pb-3 font-medium">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyticsData.comments.map((c) => (
                              <tr
                                key={c.sourceId}
                                className="border-b border-white/5 hover:bg-white/5"
                              >
                                <td className="py-3 font-mono text-xs text-white/60">
                                  #{c.sourceId.slice(-6)}
                                </td>
                                <td className="py-3 max-w-[150px] truncate text-white/80">
                                  {c.body}
                                </td>
                                <td className="py-3 text-center">
                                  <span
                                    className={`font-semibold ${
                                      c.score > 0
                                        ? "text-green-400"
                                        : c.score < 0
                                        ? "text-red-400"
                                        : "text-white/50"
                                    }`}
                                  >
                                    {c.score > 0 ? "+" : ""}
                                    {c.score}
                                  </span>
                                </td>
                                <td className="py-3 text-center">
                                  <span className="text-green-400">{c.memberLikes}</span>
                                  <span className="text-white/30 mx-1">/</span>
                                  <span className="text-red-400">{c.memberDislikes}</span>
                                </td>
                                <td className="py-3 text-center">
                                  {c.utilized ? (
                                    <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                                      MVM
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/40">
                                      Pending
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 text-white/50 text-xs">
                                  {new Date(c.createdAt).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Legend */}
                  <div className="mt-4 text-xs text-white/40">
                    <p>
                      <strong>MVM</strong> = Most Valuable Member - your comment was used to adjust a video&apos;s score
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
