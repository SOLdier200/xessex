import Link from "next/link";
import fs from "fs";
import path from "path";
import TopNav from "../../components/TopNav";

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
  "blowjob": { name: "Blowjob", icon: "💋" },
  "threesome": { name: "Threesome", icon: "👥" },
  "for-women": { name: "For Women", icon: "♀️" },
  "anal": { name: "Anal", icon: "🍑" },
  "highest-rated": { name: "Highest Rated", icon: "⭐" },
  "newest": { name: "Newest", icon: "🆕" },
};

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const allVideos = getApprovedVideos();
  const categoryInfo = CATEGORY_INFO[slug] || { name: slug.replace(/-/g, " "), icon: "📁" };

  // Filter/sort videos based on category
  let videos: ApprovedVideo[];

  if (slug === "highest-rated") {
    // Sort by views (as proxy for rating)
    videos = [...allVideos].sort((a, b) => (b.views || 0) - (a.views || 0));
  } else if (slug === "newest") {
    // Reverse order (assuming newer = later in list, or just show all)
    videos = [...allVideos].reverse();
  } else {
    // Filter by category name
    const categoryName = slug.replace(/-/g, " ");
    videos = allVideos.filter((v) =>
      v.categories?.toLowerCase().includes(categoryName.toLowerCase())
    );
  }

  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-6 pb-10">
        <Link href="/categories" className="text-gray-400 hover:text-white mb-6 inline-block">
          ← Back to Collections
        </Link>

        <section className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{categoryInfo.icon}</span>
            <div>
              <h1 className="text-2xl font-semibold neon-text">{categoryInfo.name}</h1>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {videos.map((v) => (
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
                  <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs text-white">
                    {formatDuration(v.duration)}
                  </div>
                  {v.favorite === 1 && (
                    <div className="absolute top-2 left-2 bg-yellow-500/80 px-2 py-0.5 rounded text-xs text-black font-semibold">
                      ★
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <div className="font-semibold text-white line-clamp-2 group-hover:text-pink-300 transition">
                    {v.title}
                  </div>
                  <div className="mt-2 text-xs text-white/60">
                    {v.performers || "Unknown"}
                  </div>
                  <div className="mt-1 text-xs text-white/50">
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
