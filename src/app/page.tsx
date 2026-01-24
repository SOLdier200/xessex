import Link from "next/link";
import Image from "next/image";
import fs from "fs";
import path from "path";
import TopNav from "./components/TopNav";
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

        {/* Top 20 Videos */}
        <section className="neon-border rounded-2xl p-4 md:p-6 relative overflow-hidden" style={{ background: 'linear-gradient(to bottom, #050a1a, #0a1628)', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 800 800'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.5' opacity='0.15'%3E%3Ccircle cx='100' cy='100' r='1'/%3E%3Ccircle cx='300' cy='50' r='0.5'/%3E%3Ccircle cx='500' cy='120' r='1.5'/%3E%3Ccircle cx='700' cy='80' r='0.8'/%3E%3Ccircle cx='150' cy='250' r='1'/%3E%3Ccircle cx='400' cy='200' r='0.6'/%3E%3Ccircle cx='600' cy='280' r='1.2'/%3E%3Ccircle cx='50' cy='400' r='0.7'/%3E%3Ccircle cx='250' cy='350' r='1'/%3E%3Ccircle cx='450' cy='420' r='0.5'/%3E%3Ccircle cx='650' cy='380' r='1.3'/%3E%3Ccircle cx='750' cy='450' r='0.9'/%3E%3Ccircle cx='100' cy='550' r='1.1'/%3E%3Ccircle cx='350' cy='500' r='0.6'/%3E%3Ccircle cx='550' cy='580' r='1'/%3E%3Ccircle cx='200' cy='650' r='0.8'/%3E%3Ccircle cx='400' cy='700' r='1.4'/%3E%3Ccircle cx='600' cy='650' r='0.5'/%3E%3Ccircle cx='750' cy='720' r='1'/%3E%3Ccircle cx='50' cy='750' r='0.7'/%3E%3C/g%3E%3C/svg%3E")` }}>
          <div className="mb-4">
            <Image src="/logos/textlogo/siteset3/top20100.png" alt="Top 20" width={938} height={276} className="h-[32px] w-auto" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {videos.slice(0, 20).map((v) => {
              const isShowcase = showcaseSlugs.includes(v.viewkey);
              const isLocked = !canViewPremium && !isShowcase;

              if (isLocked) {
                return (
                  <div
                    key={v.viewkey}
                    className="neon-border rounded-2xl bg-black/30 overflow-hidden relative"
                  >
                    <div className="relative aspect-video bg-black/60">
                      {v.primary_thumb ? (
                        <img
                          src={v.primary_thumb}
                          alt=""
                          className="w-full h-full object-cover blur-lg scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30 blur-md">
                          No Thumbnail
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="text-center">
                          <svg className="w-8 h-8 mx-auto text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs text-yellow-300 font-semibold mt-1 block">PREMIUM</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 md:p-3">
                      <div className="font-semibold text-white/40 text-xs md:text-sm line-clamp-2 blur-sm select-none">
                        {v.title}
                      </div>
                      <div className="mt-1 md:mt-2 text-[10px] md:text-xs text-white/30 truncate blur-sm">
                        {v.performers || "Unknown"}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] md:text-xs text-white/30">
                        <span>{formatDuration(v.duration)}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={v.viewkey}
                  href={`/videos/${v.viewkey}`}
                  className="neon-border rounded-2xl bg-black/30 overflow-hidden hover:bg-white/5 transition group"
                >
                  <div className="relative aspect-video bg-black/60">
                    {v.primary_thumb ? (
                      <img
                        src={v.primary_thumb}
                        alt={v.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30">
                        No Thumbnail
                      </div>
                    )}
                    {v.rank != null && (
                      <div
                        className="absolute top-1 left-1 md:top-1.5 md:left-1.5 min-w-[20px] md:min-w-[22px] h-5 flex items-center justify-center text-[10px] md:text-xs font-bold px-1 md:px-1.5 rounded-md bg-gradient-to-br from-purple-500/40 to-pink-500/40 text-white backdrop-blur-sm shadow-md"
                        style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}
                      >
                        #{v.rank}
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs text-white">
                      {formatDuration(v.duration)}
                    </div>
                    {v.favorite === 1 && (
                      <div className="absolute top-1 right-1 md:top-2 md:right-2 bg-yellow-500/80 px-2 py-0.5 rounded text-xs text-black font-semibold">
                        ★
                      </div>
                    )}
                    {isShowcase && !canViewPremium && (
                      <div className="absolute top-1 right-1 md:top-2 md:right-2 bg-emerald-500/80 px-2 py-0.5 rounded text-xs text-white font-semibold">
                        FREE
                      </div>
                    )}
                  </div>

                  <div className="p-2 md:p-3">
                    <div className="font-semibold text-white text-xs md:text-sm line-clamp-2 group-hover:text-pink-300 transition">
                      {v.title}
                    </div>
                    <div className="mt-1 md:mt-2 text-[10px] md:text-xs text-white/60 truncate">
                      {v.performers || "Unknown"}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] md:text-xs text-white/50">
                      <span>{formatViews(v.views)} views</span>
                      <span className="truncate ml-1">{v.categories?.split(";")[0]}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

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
