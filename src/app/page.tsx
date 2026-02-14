import Link from "next/link";
import Image from "next/image";
import fs from "fs";
import path from "path";
import TopNav from "./components/TopNav";
import LockedVideoCard from "./components/LockedVideoCard";
import LockedFeaturedCard from "./components/LockedFeaturedCard";
import RoadmapMarquee from "./components/RoadmapMarquee";
import HoverPreviewVideo from "./components/HoverPreviewVideo";
import VideoCardWithPlaylist from "./components/VideoCardWithPlaylist";
import Top20Reveal, { Top20RevealProvider, RevealGate } from "./components/Top20Reveal";
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
  xessViews?: number;
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
  // In wallet-native model, all authenticated users can view content
  // Video access is gated by unlockCost (0=free, >0=needs unlock)
  const isAuthed = access.isAuthed;

  // Get free video slugs and all video ranks from database
  const dbVideos = await db.video.findMany({
    select: { id: true, slug: true, rank: true, unlockCost: true, viewsCount: true, thumbnailUrl: true },
    orderBy: { rank: "asc" },
  });

  // Create maps for video data
  const rankMap = new Map(dbVideos.map((v) => [v.slug, v.rank]));
  const viewCountMap = new Map(dbVideos.map((v) => [v.slug, v.viewsCount ?? 0]));
  const thumbMap = new Map(dbVideos.map((v) => [v.slug, v.thumbnailUrl]));
  const idMap = new Map(dbVideos.map((v) => [v.slug, v.id]));
  const freeSlugs = dbVideos.filter((v) => v.unlockCost === 0).map((v) => v.slug);

  // Get user's unlocked videos if authenticated
  let unlockedSlugs: string[] = [];
  if (access.user?.id) {
    const userUnlocks = await db.videoUnlock.findMany({
      where: { userId: access.user.id },
      select: { video: { select: { slug: true } } },
    });
    unlockedSlugs = userUnlocks.map((u) => u.video.slug);
  }

  // Create sets for fast lookup
  const freeSet = new Set(freeSlugs);
  const unlockedSet = new Set(unlockedSlugs);

  // Merge rank into approved videos and sort: unlocked first (by rank), then locked (by rank)
  const videos = approvedVideos
    .map((v) => ({
      ...v,
      videoId: idMap.get(v.viewkey) ?? null,
      rank: rankMap.get(v.viewkey) ?? null,
      xessViews: viewCountMap.get(v.viewkey) ?? 0,
      primary_thumb: v.primary_thumb || thumbMap.get(v.viewkey) || null,
    }))
    .sort((a, b) => {
      // Determine if each video is unlocked (free or user-unlocked)
      const aUnlocked = freeSet.has(a.viewkey) || unlockedSet.has(a.viewkey);
      const bUnlocked = freeSet.has(b.viewkey) || unlockedSet.has(b.viewkey);

      // Unlocked videos come first
      if (aUnlocked && !bUnlocked) return -1;
      if (!aUnlocked && bUnlocked) return 1;

      // Within same group (both unlocked or both locked), sort by rank
      if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
      if (a.rank !== null) return -1;
      if (b.rank !== null) return 1;
      return 0;
    });

  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-4 md:px-6 pb-10">
        <Top20RevealProvider>

        {/* Top 20 Videos */}
        <Top20Reveal>
          {videos.slice(0, 21).map((v) => {
            const isFree = freeSet.has(v.viewkey);
            const hasUnlocked = unlockedSet.has(v.viewkey);
            const isLocked = !isFree && !hasUnlocked;

            if (isLocked) {
              return (
                <LockedVideoCard
                  key={v.viewkey}
                  viewkey={v.viewkey}
                  title={v.title}
                  thumb={v.primary_thumb}
                  duration={formatDuration(v.duration)}
                  rank={v.rank}
                  isAuthed={isAuthed}
                  size="small"
                  className="w-full max-w-full sm:max-w-[98%] sm:mx-auto"
                  viewsCount={v.xessViews ?? 0}
                  showMetaBelow
                />
              );
            }

            return (
              <VideoCardWithPlaylist
                key={v.viewkey}
                videoId={v.videoId || ""}
                viewkey={v.viewkey}
                title={v.title}
                thumb={v.primary_thumb}
                duration={formatDuration(v.duration)}
                rank={v.rank}
                isFree={isFree}
                isAuthed={isAuthed}
                viewsCount={v.xessViews ?? 0}
                isFavorite={v.favorite === 1}
                className="w-full max-w-full sm:max-w-[98%] sm:mx-auto"
              />
            );
          })}
        </Top20Reveal>

        {videos.length > 20 && (
          <div className="mt-6 text-center">
            <Link
              href="/videos"
              className="inline-flex items-center gap-2 text-pink-300 font-semibold hover:opacity-80 transition"
            >
              View All
              <Image
                src="/logos/textlogo/siteset3/videos.png"
                alt="Videos"
                width={938}
                height={276}
                className="h-[48px] w-auto -mt-[22px]"
              />
            </Link>
          </div>
        )}

        <section className="mt-10 rounded-2xl border border-white/10 bg-black/20 px-5 py-6 md:px-8 md:py-8 text-center">
          <h1 className="text-2xl md:text-3xl font-semibold text-white">
            HD Porn Videos, Premium Sex Content & Crypto Rewards
          </h1>
          <p className="mt-4 text-white/70">
            Xessex is a next-generation adult platform offering high-quality HD porn and premium sex
            videos. Every release is curated, verified, and ranked by the community.
          </p>
          <p className="mt-4 text-white/70">
            Users can earn crypto rewards for watching videos, engaging with content, and
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
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 max-w-full md:max-w-[95%] mx-auto">
          {/* Featured Video */}
          {videos.length > 0 && videos[0].favorite === 1 && (() => {
            const featured = videos[0];
            const isFeaturedFree = freeSet.has(featured.viewkey);
            const isFeaturedUnlocked = unlockedSet.has(featured.viewkey);
            // Locked unless free OR user has unlocked it
            const isFeaturedLocked = !isFeaturedFree && !isFeaturedUnlocked;
            const featuredViews = viewCountMap.get(featured.viewkey) ?? 0;

            const card = isFeaturedLocked ? (
              <LockedFeaturedCard
                viewkey={featured.viewkey}
                title={featured.title}
                thumb={featured.primary_thumb}
                duration={formatDuration(featured.duration)}
                performers={featured.performers || "Unknown"}
                isAuthed={isAuthed}
                variant="featured"
                className="w-full max-w-full md:max-w-[70%] md:mx-auto"
                viewsCount={featuredViews}
                showMetaBelow
              />
            ) : (
              <section className="neon-border rounded-2xl p-4 md:p-6 bg-black/30 w-full max-w-full md:max-w-[70%] md:mx-auto">
                <h2 className="text-lg font-semibold neon-text mb-4">Featured Video</h2>
                <Link href={`/videos/${featured.viewkey}`} className="block w-full">
                  <div className="relative aspect-video rounded-xl overflow-hidden">
                    {featured.primary_thumb && (
                      <img
                        src={featured.primary_thumb}
                        alt={`Featured video: ${featured.title}`}
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                      />
                    )}
                    <div className="absolute bottom-2 left-2 bg-pink-500/80 px-2 py-1 rounded text-sm text-white font-semibold">
                      Featured
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-white/70">
                    <span>{formatDuration(featured.duration)}</span>
                    <span>{formatViews(featuredViews)} XESS Views</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-white hover:text-pink-300 transition">
                    {featured.title}
                  </h3>
                  <p className="mt-1 text-sm text-white/60">
                    {featured.performers || "Unknown"}
                  </p>
                </Link>
              </section>
            );

            return card;
          })()}

          {/* Top Ranked Video — hidden until Top 20 reveal */}
          <RevealGate delay={4000}>
            {videos.length > 0 && (() => {
              const topRanked = videos.find((v) => v.rank === 1) || videos[0];
              const isTopFree = freeSet.has(topRanked.viewkey);
              const isTopUnlocked = unlockedSet.has(topRanked.viewkey);
              const isTopLocked = !isTopFree && !isTopUnlocked;
              const topRankedViews = viewCountMap.get(topRanked.viewkey) ?? 0;

              return (
                <div className="w-full max-w-full md:max-w-[70%]">
                  <h2 className="text-lg font-semibold text-yellow-400 mb-4">Top Ranked Video</h2>
                  {isTopLocked ? (
                    <LockedVideoCard
                      viewkey={topRanked.viewkey}
                      title={topRanked.title}
                      thumb={topRanked.primary_thumb}
                      duration={formatDuration(topRanked.duration)}
                      rank={1}
                      isAuthed={isAuthed}
                      size="small"
                      className="w-full"
                      viewsCount={topRankedViews}
                      showMetaBelow
                      borderVariant="blue"
                    />
                  ) : (
                    <Link
                      href={`/videos/${topRanked.viewkey}`}
                      className="neon-border-blue rounded-lg sm:rounded-2xl bg-black/30 overflow-hidden hover:bg-white/5 transition group block"
                    >
                      <div className="relative aspect-video bg-black/60">
                        {topRanked.primary_thumb ? (
                          <img
                            src={topRanked.primary_thumb}
                            alt={topRanked.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/30">
                            No Thumbnail
                          </div>
                        )}
                        <div
                          className="absolute top-1 left-1 md:top-1.5 md:left-1.5 min-w-[20px] md:min-w-[22px] h-5 flex items-center justify-center text-[10px] md:text-xs font-bold px-1 md:px-1.5 rounded-md bg-gradient-to-br from-purple-500/40 to-pink-500/40 text-white backdrop-blur-sm shadow-md"
                          style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}
                        >
                          #1
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1 text-[10px] md:text-xs text-white/70 bg-black/30">
                        <span>{formatDuration(topRanked.duration)}</span>
                        <span>{formatViews(topRankedViews)} XESS Views</span>
                      </div>
                    </Link>
                  )}
                </div>
              );
            })()}
          </RevealGate>

        </div>
        </Top20RevealProvider>

      </div>

      {/* Roadmap Section */}
      <div className="mt-16">
        <RoadmapMarquee />
      </div>
    </main>
  );
}
