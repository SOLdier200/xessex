import Link from "next/link";
import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import TopNav from "../../components/TopNav";
import CollectionVideoCard from "../../components/CollectionVideoCard";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

const CATEGORY_META: Record<string, { title: string; description: string }> = {
  "blonde": {
    title: "Blonde Adult Videos – Watch & Earn Crypto on Xessex",
    description: "Browse verified blonde adult videos. Earn crypto rewards for watching curated content on Xessex.",
  },
  "brunette": {
    title: "Brunette Adult Videos – Watch & Earn Crypto on Xessex",
    description: "Browse verified brunette adult videos. Earn crypto rewards for watching curated content on Xessex.",
  },
  "blowjob": {
    title: "Blowjob Adult Videos – Watch & Earn Crypto on Xessex",
    description: "Browse verified blowjob adult videos. Earn crypto rewards for watching curated content on Xessex.",
  },
  "threesome": {
    title: "Threesome Adult Videos – Watch & Earn Crypto on Xessex",
    description: "Browse verified threesome adult videos. Earn crypto rewards for watching curated content on Xessex.",
  },
  "for-women": {
    title: "Adult Videos For Women – Watch & Earn Crypto on Xessex",
    description: "Browse verified adult videos for women. Earn crypto rewards for watching curated content on Xessex.",
  },
  "anal": {
    title: "Anal Adult Videos – Watch & Earn Crypto on Xessex",
    description: "Browse verified anal adult videos. Earn crypto rewards for watching curated content on Xessex.",
  },
  "asian": {
    title: "Asian Adult Videos – Watch & Earn Crypto on Xessex",
    description: "Browse verified Asian adult videos. Earn crypto rewards for watching curated content on Xessex.",
  },
  "latina": {
    title: "Latina Adult Videos – Watch & Earn Crypto on Xessex",
    description: "Browse verified Latina adult videos. Earn crypto rewards for watching curated content on Xessex.",
  },
  "black": {
    title: "Black Adult Videos – Watch & Earn Crypto on Xessex",
    description: "Browse verified Black adult videos. Earn crypto rewards for watching curated content on Xessex.",
  },
  "2d": {
    title: "2D Animated Adult Videos – Watch & Earn Crypto on Xessex",
    description: "Browse verified animated adult videos. Earn crypto rewards for watching curated content on Xessex.",
  },
  "highest-rated": {
    title: "Highest Rated Adult Videos – Top Content on Xessex",
    description: "Browse the highest rated adult videos on Xessex. Top-ranked content with crypto rewards.",
  },
};

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const meta = CATEGORY_META[slug] || {
    title: `${slug.replace(/-/g, " ")} Adult Videos – Xessex`,
    description: `Browse ${slug.replace(/-/g, " ")} adult videos on Xessex. Earn crypto rewards for watching.`,
  };

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `/collections/${slug}`,
    },
    openGraph: {
      type: "website",
      url: `https://xessex.me/collections/${slug}`,
      title: meta.title,
      description: meta.description,
    },
  };
}

type ApprovedVideo = {
  id: number;
  viewkey: string;
  title: string;
  primary_thumb: string | null;
  duration: number | null;
  views: number | null;
  categories: string | null;
  performers: string | null;
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

const R2_BASE = "https://pub-77b523433fb04971ba656a572f298a11.r2.dev";

const CATEGORY_INFO: Record<string, { name: string; icon: string; image?: string }> = {
  "blonde": { name: "Blonde", icon: "", image: `${R2_BASE}/blonde.jpg` },
  "brunette": { name: "Brunette", icon: "", image: `${R2_BASE}/brunette.jpg` },
  "blowjob": { name: "Blowjob", icon: "", image: `${R2_BASE}/blowjob.jpg` },
  "threesome": { name: "Threesome", icon: "", image: `${R2_BASE}/threesome2.png` },
  "for-women": { name: "For Women", icon: "♀️" },
  "anal": { name: "Anal", icon: "", image: `${R2_BASE}/anal23.png` },
  "latina": { name: "Latina", icon: "", image: `${R2_BASE}/latina.jpg` },
  "black": { name: "Black", icon: "", image: `${R2_BASE}/black.jpg` },
  "asian": { name: "Asian", icon: "", image: `${R2_BASE}/asian100.webp` },
  "2d": { name: "2D Animated", icon: "", image: `${R2_BASE}/2dpic.webp` },
  "highest-rated": { name: "Highest Rated", icon: "⭐" },
};

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const allApprovedVideos = getApprovedVideos();
  const categoryInfo = CATEGORY_INFO[slug] || { name: slug.replace(/-/g, " "), icon: "📁" };

  // Get access context to check user's unlocked videos
  const access = await getAccessContext();
  const userId = access.user?.id || null;

  // Fetch all active video ranks and unlock costs from DB
  const dbVideos = await db.video.findMany({
    where: { isActive: true },
    select: { slug: true, rank: true, unlockCost: true, id: true, thumbnailUrl: true },
  });
  const rankMap = new Map(dbVideos.map((v) => [v.slug, v.rank]));
  const unlockCostMap = new Map(dbVideos.map((v) => [v.slug, v.unlockCost]));
  const videoIdMap = new Map(dbVideos.map((v) => [v.slug, v.id]));
  const thumbMap = new Map(dbVideos.map((v) => [v.slug, v.thumbnailUrl]));

  // Get user's unlocked videos if logged in
  const userUnlockedSet = new Set<string>();
  if (userId) {
    const unlocks = await db.videoUnlock.findMany({
      where: { userId },
      select: { videoId: true },
    });
    for (const u of unlocks) {
      userUnlockedSet.add(u.videoId);
    }
  }

  // Helper to check if video is locked for this user
  const isVideoLocked = (viewkey: string): boolean => {
    const unlockCost = unlockCostMap.get(viewkey);

    // SECURITY: if it isn't in the DB map, treat as locked (never default to free)
    if (unlockCost == null) return true;

    // Free video
    if (unlockCost === 0) return false;

    // TESTING: do NOT allow admin/mod bypass right now
    // if (access.isAdminOrMod) return false;

    const videoId = videoIdMap.get(viewkey);

    // If somehow we have an unlockCost but no videoId, lock it
    if (!videoId) return true;

    // User must have an unlock record
    if (userUnlockedSet.has(videoId)) return false;

    return true;
  };

  // Only show videos that exist in DB and are active (hide phantom items)
  const dbSlugSet = new Set(dbVideos.map((v) => v.slug));
  const approvedInDb = allApprovedVideos.filter((v) => dbSlugSet.has(v.viewkey));

  // Debug log — remove after confirming fix
  const missing = allApprovedVideos.filter((v) => !dbSlugSet.has(v.viewkey));
  console.log("COLLECTION_DEBUG", {
    category: slug,
    approvedJsonTotal: allApprovedVideos.length,
    dbTotal: dbVideos.length,
    missingFromDb: missing.length,
    sampleMissing: missing.slice(0, 5).map((v) => v.viewkey),
  });

  // Merge rank into approved videos
  const allVideos = approvedInDb.map((v) => ({
    ...v,
    rank: rankMap.get(v.viewkey) ?? null,
    primary_thumb: v.primary_thumb || thumbMap.get(v.viewkey) || null,
  }));

  // Filter/sort videos based on category
  let videos: ApprovedVideo[];

  if (slug === "highest-rated") {
    // Sort by rank (star ratings)
    videos = [...allVideos].sort((a, b) => {
      if (a.rank != null && b.rank != null) return a.rank - b.rank;
      if (a.rank != null) return -1;
      if (b.rank != null) return 1;
      return 0;
    });
  } else if (slug === "2d") {
    // 2D Animated matches "cartoon" or "hentai" categories
    videos = allVideos
      .filter((v) => {
        const cats = v.categories?.toLowerCase() ?? "";
        return cats.includes("cartoon") || cats.includes("hentai");
      })
      .sort((a, b) => {
        if (a.rank != null && b.rank != null) return a.rank - b.rank;
        if (a.rank != null) return -1;
        if (b.rank != null) return 1;
        return 0;
      });
  } else if (slug === "black") {
    // "Black" matches "ebony" or "black" in categories
    videos = allVideos
      .filter((v) => {
        const cats = v.categories?.toLowerCase() ?? "";
        return cats.includes("ebony") || cats.includes("black");
      })
      .sort((a, b) => {
        if (a.rank != null && b.rank != null) return a.rank - b.rank;
        if (a.rank != null) return -1;
        if (b.rank != null) return 1;
        return 0;
      });
  } else {
    // Filter by category name, then sort by rank
    const categoryName = slug.replace(/-/g, " ");
    videos = allVideos
      .filter((v) => v.categories?.toLowerCase().includes(categoryName.toLowerCase()))
      .sort((a, b) => {
        if (a.rank != null && b.rank != null) return a.rank - b.rank;
        if (a.rank != null) return -1;
        if (b.rank != null) return 1;
        return 0;
      });
  }

  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-4 md:px-6 pb-10">
        <Link href="/collections" className="text-gray-400 hover:text-white mb-4 md:mb-6 inline-block text-sm">
          ← Back to Collections
        </Link>

        <section className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl font-semibold neon-text text-center mb-3">{categoryInfo.name}</h1>
          {categoryInfo.image ? (
            <div className="flex flex-col items-center">
              <img
                src={categoryInfo.image}
                alt={categoryInfo.name}
                className="w-32 md:w-40 h-40 md:h-52 object-cover rounded-lg"
              />
              <p className="mt-2 text-sm text-white/70">
                {videos.length} videos
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-3xl md:text-4xl">{categoryInfo.icon}</span>
              <p className="mt-1 text-sm text-white/70">
                {videos.length} videos
              </p>
            </div>
          )}
          <div className="mt-4 border-t border-white/10" />
        </section>

        {videos.length === 0 ? (
          <div className="text-center py-12 text-white/60">
            No videos in this category yet
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
            {videos.map((v, i) => {
              const locked = isVideoLocked(v.viewkey);
              const videoId = videoIdMap.get(v.viewkey) || "";
              return (
                <CollectionVideoCard
                  key={v.viewkey}
                  videoId={videoId}
                  viewkey={v.viewkey}
                  title={locked ? "Locked Video" : v.title}
                  thumb={v.primary_thumb}
                  duration={formatDuration(v.duration)}
                  rank={locked ? null : v.rank}
                  locked={locked}
                  isAuthed={access.isAuthed}
                  views={locked ? "" : formatViews(v.views)}
                  isFavorite={!locked && v.favorite === 1}
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
