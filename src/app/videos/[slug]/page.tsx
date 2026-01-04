import fs from "fs";
import path from "path";
import Link from "next/link";
import TopNav from "../../components/TopNav";
import StarRating from "../../components/StarRating";

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

interface VideoPageProps {
  params: Promise<{ slug: string }>;
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { slug } = await params;
  const videos = getApprovedVideos();
  const video = videos.find((v) => v.viewkey === slug);

  if (!video) {
    return (
      <main className="min-h-screen">
        <TopNav />
        <div className="px-6 py-12 text-center">
          <h1 className="text-2xl font-bold text-white">Video not found</h1>
          <Link href="/" className="text-pink-400 hover:underline mt-4 inline-block">
            Go back home
          </Link>
        </div>
      </main>
    );
  }

  // Get related videos (same performer or category)
  const related = videos
    .filter((v) => v.viewkey !== video.viewkey)
    .slice(0, 4);

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10">
        <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
          ← Back to Home
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Video */}
          <div className="lg:col-span-2">
            <div className="aspect-video bg-black rounded-xl overflow-hidden neon-border">
              <iframe
                src={`https://www.pornhub.com/embed/${video.viewkey}`}
                frameBorder={0}
                width="100%"
                height="100%"
                allowFullScreen
              />
            </div>

            <h1 className="mt-4 text-2xl font-bold text-white">{video.title}</h1>

            <div className="mt-2 flex items-center gap-4 text-sm text-white/60">
              <span>{formatViews(video.views)} views</span>
              <span>{formatDuration(video.duration)}</span>
              {video.favorite === 1 && (
                <span className="text-yellow-400">★ Featured</span>
              )}
            </div>

            {video.performers && (
              <div className="mt-4">
                <span className="text-white/50 text-sm">Performers: </span>
                <span className="text-pink-300">{video.performers}</span>
              </div>
            )}

            {video.categories && (
              <div className="mt-2">
                <span className="text-white/50 text-sm">Collections: </span>
                <span className="text-white/70">{video.categories.replace(/;/g, ", ")}</span>
              </div>
            )}

            {video.tags && (
              <div className="mt-4 flex flex-wrap gap-2">
                {video.tags.split(";").slice(0, 10).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs rounded-lg bg-white/10 text-white/70"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Star Rating System */}
            <div className="mt-6">
              <StarRating viewkey={video.viewkey} />
            </div>
          </div>

          {/* Sidebar - Related */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold neon-text mb-4">More Videos</h2>
            <div className="space-y-4">
              {related.map((v) => (
                <Link
                  key={v.viewkey}
                  href={`/videos/${v.viewkey}`}
                  className="flex gap-3 group"
                >
                  <div className="relative w-32 shrink-0 aspect-video bg-black/60 rounded-lg overflow-hidden">
                    {v.primary_thumb && (
                      <img
                        src={v.primary_thumb}
                        alt={v.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    )}
                    <div className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-xs text-white">
                      {formatDuration(v.duration)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white line-clamp-2 group-hover:text-pink-300 transition">
                      {v.title}
                    </div>
                    <div className="mt-1 text-xs text-white/50">
                      {formatViews(v.views)} views
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
