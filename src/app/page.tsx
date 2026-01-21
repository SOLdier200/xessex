import Link from "next/link";
import Image from "next/image";
import fs from "fs";
import path from "path";
import TopNav from "./components/TopNav";
import WalletStatus from "./components/WalletStatus";
import VideoSearch from "./components/VideoSearch";
import AdminManualPaymentNotice from "./components/AdminManualPaymentNotice";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";

type ApprovedVideo = {
  id: number;
  viewkey: string;
  title: string;
  primary_thumb: string | null;
  duration: number | null;
  views: number | null;
  tags: string | null;
  categories: string | null;
  performers: string | null;
  status: string;
  note: string | null;
  favorite: number;
  rank?: number | null;
};

function getApprovedVideos(): ApprovedVideo[] {
  try {
    const filePath = path.join(process.cwd(), "data", "approved.json");
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatViews(views: number | null): string {
  if (!views) return "--";
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return views.toString();
}

// These are still used by Featured/Top Ranked sections

export default async function HomePage() {
  const approvedVideos = getApprovedVideos();
  const access = await getAccessContext();
  const canViewPremium = access.canViewAllVideos;

  // Get showcase video slugs and all video ranks from database
  const dbVideos = await db.video.findMany({
    select: { slug: true, rank: true, isShowcase: true },
    orderBy: { rank: "asc" },
  });

  // Create a map of slug -> rank
  const rankMap = new Map(dbVideos.map((v) => [v.slug, v.rank]));
  const showcaseSlugs = dbVideos.filter((v) => v.isShowcase).map((v) => v.slug);

  // Merge rank into approved videos and sort by rank
  const videos = approvedVideos
    .map((v) => ({ ...v, rank: rankMap.get(v.viewkey) ?? null }))
    .sort((a, b) => {
      // Videos with rank come first, sorted by rank ascending
      if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
      if (a.rank !== null) return -1;
      if (b.rank !== null) return 1;
      return 0;
    });

  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-4 md:px-6 pb-10">
        <AdminManualPaymentNotice />
        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4 mb-6">
            <Link
              href="/collections"
              className="group flex h-full flex-col justify-between rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 via-black/0 to-emerald-500/5 px-3 py-3 md:px-5 md:py-4 text-white shadow-[0_0_18px_rgba(16,185,129,0.18)] transition hover:-translate-y-0.5 hover:border-emerald-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
            >
              <div>
                <Image src="/logos/textlogo/collections.png" alt="Collections" width={938} height={276} priority fetchPriority="high" className="mt-1 h-[44px] w-auto" />
                <p className="mt-2 text-sm text-white/70">Evaluate content from different Collections.</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                Explore
              </span>
            </Link>

            <Link
              href="/signup"
              className="group flex h-full flex-col justify-between rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-yellow-500/25 via-black/0 to-yellow-500/10 px-3 py-3 md:px-5 md:py-4 text-white shadow-[0_0_18px_rgba(234,179,8,0.18)] transition hover:-translate-y-0.5 hover:border-yellow-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
            >
              <div>
                <Image src="/logos/textlogo/membersignup.png" alt="Member Signup" width={1230} height={238} priority fetchPriority="high" className="mt-1 h-[44px] w-auto" />
                <p className="mt-2 text-sm text-white/70">Start earning <span className="text-green-400 font-bold">$</span> for viewing and grading content!</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                Join Now
              </span>
            </Link>

            <Link
              href="/login"
              className="group flex h-full flex-col justify-between rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/20 via-black/0 to-sky-500/10 px-3 py-3 md:px-5 md:py-4 text-white shadow-[0_0_18px_rgba(56,189,248,0.2)] transition hover:-translate-y-0.5 hover:border-sky-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
            >
              <div>
                <Image src="/logos/textlogo/memberlogin.png" alt="Member Login" width={982} height={247} priority fetchPriority="high" className="mt-1 h-[44px] w-auto" />
                <p className="mt-2 text-sm text-white/70">One-click sign in for Ultimate Access!</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                Diamond Connect
              </span>
            </Link>

            <Link
              href="/leaderboard"
              className="group flex h-full flex-col justify-between rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-500/20 via-black/0 to-purple-500/10 px-3 py-3 md:px-5 md:py-4 text-white shadow-[0_0_18px_rgba(168,85,247,0.2)] transition hover:-translate-y-0.5 hover:border-purple-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/70"
            >
              <div>
                <Image src="/logos/textlogo/diamondladder.png" alt="Diamond Ladder" width={1308} height={286} priority fetchPriority="high" className="mt-1 h-[44px] w-auto" />
                <p className="mt-2 text-sm text-white/70">See top ranked Diamond Members!</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                View Rankings
              </span>
            </Link>
        </div>

        <VideoSearch videos={videos.slice(0, 20)} canViewPremium={canViewPremium} showcaseSlugs={showcaseSlugs} />

        {videos.length > 20 && (
          <div className="mt-6 text-center">
            <Link
              href="/videos"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-pink-500/20 border border-pink-400/40 text-pink-300 font-semibold hover:bg-pink-500/30 transition"
            >
              View All Videos
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
        )}

        <section className="mt-10 rounded-2xl border border-white/10 bg-black/20 px-5 py-6 md:px-8 md:py-8">
          <h1 className="text-2xl md:text-3xl font-semibold text-white">
            HD Porn Videos, Premium Sex Content & Crypto Rewards
          </h1>
          <p className="mt-4 text-white/70">
            Xessex is a next-generation adult platform offering high-quality HD porn and premium sex
            videos. Every release is curated, verified, and ranked by the community.
          </p>
          <p className="mt-4 text-white/70">
            Members can earn crypto rewards for watching videos, engaging with content, and
            supporting creators. Xessex runs on Solana, enabling fast rewards with XESS tokens and
            Diamond tiers for premium access.
          </p>
          <p className="mt-4 text-white/70">
            If you are looking for the best porn online and top-ranked XXX videos with a modern,
            reward-driven experience, Xessex delivers quality, speed, and privacy.
          </p>
          <div className="mt-4">
            <Link
              href="/earn-crypto-watching-porn"
              className="text-sm font-semibold text-pink-300 hover:text-pink-200 transition"
            >
              Learn how to earn crypto watching porn
            </Link>
          </div>
        </section>

        {/* Featured & Top Ranked Videos */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Featured Video */}
          {videos.length > 0 && videos[0].favorite === 1 && (() => {
            const featured = videos[0];
            const isFeaturedShowcase = showcaseSlugs.includes(featured.viewkey);
            const isFeaturedLocked = !canViewPremium && !isFeaturedShowcase;

            if (isFeaturedLocked) {
              return (
                <section className="neon-border rounded-2xl p-4 md:p-6 bg-black/30">
                  <h2 className="text-lg font-semibold neon-text mb-4">Featured Video</h2>
                  <div className="block w-full">
                    <div className="relative aspect-video rounded-xl overflow-hidden">
                      {featured.primary_thumb && (
                        <img
                          src={featured.primary_thumb}
                          alt=""
                          className="w-full h-full object-cover blur-lg scale-110"
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="text-center">
                          <svg className="w-10 h-10 mx-auto text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-yellow-300 font-semibold mt-2 block">PREMIUM</span>
                        </div>
                      </div>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-white/40 blur-sm select-none">
                      {featured.title}
                    </h3>
                    <p className="mt-1 text-sm text-white/30 blur-sm">
                      {featured.performers || "Unknown"}
                    </p>
                  </div>
                </section>
              );
            }

            return (
              <section className="neon-border rounded-2xl p-4 md:p-6 bg-black/30">
                <h2 className="text-lg font-semibold neon-text mb-4">Featured Video</h2>
                <Link href={`/videos/${featured.viewkey}`} className="block w-full">
                  <div className="relative aspect-video rounded-xl overflow-hidden">
                    {featured.primary_thumb && (
                      <img
                        src={featured.primary_thumb}
                        alt={featured.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                      />
                    )}
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-sm text-white">
                      {formatDuration(featured.duration)}
                    </div>
                    <div className="absolute bottom-2 left-2 bg-pink-500/80 px-2 py-1 rounded text-sm text-white font-semibold">
                      Featured
                    </div>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-white hover:text-pink-300 transition">
                    {featured.title}
                  </h3>
                  <p className="mt-1 text-sm text-white/60">
                    {featured.performers || "Unknown"} • {formatViews(featured.views)} views
                  </p>
                </Link>
              </section>
            );
          })()}

          {/* Top Ranked Video */}
          {videos.length > 0 && (() => {
            // Get actual #1 ranked video (videos already sorted by rank)
            const topRanked = videos[0];
            const isTopShowcase = showcaseSlugs.includes(topRanked.viewkey);
            const isTopLocked = !canViewPremium && !isTopShowcase;

            if (isTopLocked) {
              return (
                <section className="neon-border rounded-2xl p-4 md:p-6 bg-black/30 border-yellow-400/30">
                  <h2 className="text-lg font-semibold text-yellow-400 mb-4">Top Ranked Video</h2>
                  <div className="block w-full">
                    <div className="relative aspect-video rounded-xl overflow-hidden">
                      {topRanked.primary_thumb && (
                        <img
                          src={topRanked.primary_thumb}
                          alt=""
                          className="w-full h-full object-cover blur-lg scale-110"
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="text-center">
                          <svg className="w-10 h-10 mx-auto text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-yellow-300 font-semibold mt-2 block">PREMIUM</span>
                        </div>
                      </div>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-white/40 blur-sm select-none">
                      {topRanked.title}
                    </h3>
                    <p className="mt-1 text-sm text-white/30 blur-sm">
                      {topRanked.performers || "Unknown"}
                    </p>
                  </div>
                </section>
              );
            }

            return (
              <section className="neon-border rounded-2xl p-4 md:p-6 bg-black/30 border-yellow-400/30">
                <h2 className="text-lg font-semibold text-yellow-400 mb-4">Top Ranked Video</h2>
                <Link href={`/videos/${topRanked.viewkey}`} className="block w-full">
                  <div className="relative aspect-video rounded-xl overflow-hidden">
                    {topRanked.primary_thumb && (
                      <img
                        src={topRanked.primary_thumb}
                        alt={topRanked.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                      />
                    )}
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-sm text-white">
                      {formatDuration(topRanked.duration)}
                    </div>
                    <div className="absolute bottom-2 left-2 bg-yellow-500/80 px-2 py-1 rounded text-sm text-black font-semibold">
                      #1 Ranked
                    </div>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-white hover:text-yellow-300 transition">
                    {topRanked.title}
                  </h3>
                  <p className="mt-1 text-sm text-white/60">
                    {topRanked.performers || "Unknown"} • {formatViews(topRanked.views)} views
                  </p>
                </Link>
              </section>
            );
          })()}
        </div>

      </div>
    </main>
  );
}
