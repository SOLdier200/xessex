import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import TopNav from "../../components/TopNav";
import StarRating from "../../components/StarRating";
import Comments from "../../components/Comments";
import ViewTracker from "../../components/ViewTracker";

export const dynamic = "force-dynamic";

interface VideoPageProps {
  params: Promise<{ slug: string }>;
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { slug } = await params;
  const access = await getAccessContext();

  const video = await db.video.findFirst({
    where: { slug },
  });

  if (!video) notFound();

  const canViewPremium = access.canViewAllVideos;

  // Hard gate: premium videos 404 for free users (no title leak)
  if (!video.isShowcase && !canViewPremium) {
    notFound();
  }

  // Tier-aware engagement permissions
  const canRateStars = !!access.user && access.canRateStars; // diamond-only
  const canPostComment = !!access.user && access.canComment; // diamond-only
  const canVoteComments = !!access.user && access.canVoteComments; // paid+

  // Get related videos for sidebar
  const relatedVideos = await db.video.findMany({
    where: {
      id: { not: video.id },
      // Show showcase to everyone, premium only to paid
      ...(canViewPremium ? {} : { isShowcase: true }),
    },
    take: 4,
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen">
      <TopNav />
      <ViewTracker videoId={video.id} />

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">
              {video.title}
            </h1>
            <div className="mt-1 text-xs text-white/50 font-mono break-all">
              {video.slug}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`text-[10px] px-3 py-1 rounded-full border ${
                  video.isShowcase
                    ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-200"
                    : "bg-pink-500/20 border-pink-400/30 text-pink-200"
                }`}
              >
                {video.isShowcase ? "free" : "premium"}
              </span>
              <span className="text-xs text-white/40">
                Views: {video.viewsCount.toLocaleString()}
              </span>
              {video.starsCount > 0 && (
                <span className="text-xs text-yellow-400">
                  ★ {video.avgStars.toFixed(1)} ({video.starsCount})
                </span>
              )}
            </div>
          </div>

          <Link
            href="/videos"
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
          >
            Back to Videos
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Main Video */}
          <div className="lg:col-span-2">
            <div className="neon-border rounded-2xl overflow-hidden bg-black/30">
              <div className="aspect-video bg-black">
                {video.embedUrl ? (
                  <iframe
                    src={video.embedUrl}
                    frameBorder={0}
                    width="100%"
                    height="100%"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/30">
                    Video embed not configured
                  </div>
                )}
              </div>
            </div>

            {/* Star Rating */}
            <div className="mt-4 md:mt-6">
              <StarRating videoId={video.id} readOnly={!canRateStars} />
            </div>

            {/* Comments Section */}
            <Comments videoId={video.id} canPost={canPostComment} canVote={canVoteComments} />
          </div>

          {/* Sidebar - Related */}
          <div className="lg:col-span-1 mt-4 lg:mt-0">
            <h2 className="text-lg font-semibold neon-text mb-4">
              More Videos
            </h2>

            {relatedVideos.length === 0 ? (
              <p className="text-white/50 text-sm">No other videos available.</p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:gap-4">
                {relatedVideos.map((v) => (
                  <Link
                    key={v.id}
                    href={`/videos/${v.slug}`}
                    className="flex flex-col lg:flex-row gap-2 lg:gap-3 group"
                  >
                    <div className="relative w-full lg:w-32 shrink-0 aspect-video bg-black/60 rounded-lg overflow-hidden">
                      {v.thumbnailUrl ? (
                        <img
                          src={v.thumbnailUrl}
                          alt={v.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30">
                          <svg
                            className="w-8 h-8"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs lg:text-sm font-medium text-white line-clamp-2 group-hover:text-pink-300 transition">
                        {v.title}
                      </div>
                      <div className="mt-1 text-[10px] lg:text-xs text-white/50">
                        {v.avgStars > 0 && (
                          <span className="text-yellow-400">
                            ★ {v.avgStars.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Upgrade CTA for free users */}
            {!canViewPremium && (
              <div className="mt-6 neon-border rounded-xl p-4 bg-black/30">
                <h3 className="text-sm font-semibold text-white mb-2">
                  Want more?
                </h3>
                <p className="text-xs text-white/60 mb-3">
                  Upgrade to unlock the full premium catalog.
                </p>
                <Link
                  href="/signup"
                  className="block w-full text-center px-4 py-2 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 text-yellow-100 text-sm font-semibold transition"
                >
                  Upgrade
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
