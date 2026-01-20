import Link from "next/link";
import fs from "fs";
import path from "path";
import TopNav from "../../components/TopNav";
import { db } from "@/lib/prisma";

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

const CATEGORY_INFO: Record<string, { name: string; icon: string }> = {
  "blonde": { name: "Blonde", icon: "" },
  "brunette": { name: "Brunette", icon: "" },
  "blowjob": { name: "Blowjob", icon: "" },
  "threesome": { name: "Threesome", icon: "" },
  "for-women": { name: "For Women", icon: "♀️" },
  "anal": { name: "Anal", icon: "" },
  "2d": { name: "2D Animated", icon: "" },
  "highest-rated": { name: "Highest Rated", icon: "⭐" },
};

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const allApprovedVideos = getApprovedVideos();
  const categoryInfo = CATEGORY_INFO[slug] || { name: slug.replace(/-/g, " "), icon: "📁" };

  // Fetch all video ranks from DB
  const dbVideos = await db.video.findMany({
    select: { slug: true, rank: true },
  });
  const rankMap = new Map(dbVideos.map((v) => [v.slug, v.rank]));

  // Merge rank into approved videos
  const allVideos = allApprovedVideos.map((v) => ({
    ...v,
    rank: rankMap.get(v.viewkey) ?? null,
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

        <section className="neon-border rounded-2xl p-4 md:p-6 bg-black/30 mb-4 md:mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl md:text-4xl">{categoryInfo.icon}</span>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold neon-text">{categoryInfo.name}</h1>
              <p className="mt-1 text-sm text-white/70">
                {videos.length} videos
              </p>
            </div>
          </div>
        </section>

        {videos.length === 0 ? (
          <div className="text-center py-12 text-white/60">
            No videos in this category yet
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {videos.map((v) => (
              <Link
                key={v.viewkey}
                href={`/videos/${v.viewkey}`}
                className="neon-border rounded-2xl bg-black/30 overflow-hidden hover:bg-white/5 active:bg-white/10 transition group"
              >
                <div className="relative aspect-video bg-black/60">
                  {v.primary_thumb ? (
                    <img
                      src={v.primary_thumb}
                      alt={v.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">
                      No Thumbnail
                    </div>
                  )}
                  {/* Rank Badge */}
                  {v.rank != null && (
                    <div className="absolute top-1 left-1 md:top-1.5 md:left-1.5 min-w-[20px] md:min-w-[22px] h-5 flex items-center justify-center text-[10px] md:text-xs font-bold px-1 md:px-1.5 rounded-md bg-gradient-to-br from-purple-500/80 to-pink-500/80 text-white/90 backdrop-blur-sm shadow-md">
                      #{v.rank}
                    </div>
                  )}
                  <div className="absolute bottom-1 right-1 md:bottom-2 md:right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] md:text-xs text-white">
                    {formatDuration(v.duration)}
                  </div>
                  {v.favorite === 1 && (
                    <div className="absolute top-1 right-1 md:top-2 md:right-2 bg-yellow-500/80 px-1.5 py-0.5 rounded text-[10px] md:text-xs text-black font-semibold">
                      ★
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
                  <div className="mt-1 text-[10px] md:text-xs text-white/50">
                    {formatViews(v.views)} views
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
