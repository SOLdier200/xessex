import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import TopNav from "../../components/TopNav";
import StarRating from "../../components/StarRating";
import Comments from "../../components/Comments";

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface VideoPageProps {
  params: Promise<{ slug: string }>;
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { slug } = await params;
  const access = await getAccessContext();

  // Get the video
  const video = await db.video.findFirst({
    where: { slug },
  });

  if (!video) {
    notFound();
  }

  // If it's a showcase video, redirect to /free/[slug]
  if (video.isShowcase) {
    redirect(`/free/${slug}`);
  }

  // If user can't view premium content, show paywall
  if (!access.canViewAllVideos) {
    return (
      <main className="min-h-screen">
        <TopNav />
        <div className="px-4 md:px-6 pb-10">
          <Link
            href="/videos"
            className="text-gray-400 hover:text-white mb-4 md:mb-6 inline-block text-sm"
          >
            ← Back to Videos
          </Link>

          <div className="max-w-2xl mx-auto">
            <div className="neon-border rounded-2xl p-8 bg-gradient-to-br from-pink-500/10 via-black/0 to-purple-500/10 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-pink-500/20 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-pink-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>

              <h1 className="text-2xl font-bold text-white mb-2">
                Premium Content
              </h1>
              <p className="text-white/70 mb-6">
                This video is available to members only. Subscribe to unlock
                unlimited access to our entire catalog.
              </p>

              <div className="p-4 rounded-xl bg-black/30 border border-white/10 mb-6">
                <h2 className="font-semibold text-white">{video.title}</h2>
                {video.avgStars > 0 && (
                  <div className="text-sm text-yellow-400 mt-1">
                    ★ {video.avgStars.toFixed(1)} ({video.starsCount} ratings)
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/subscribe"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white font-medium transition"
                >
                  Subscribe Now
                </Link>
                <Link
                  href="/signup"
                  className="px-6 py-3 rounded-xl bg-yellow-500/80 hover:bg-yellow-500 text-black font-medium transition"
                >
                  Become Diamond Member
                </Link>
              </div>

              <p className="mt-6 text-xs text-white/40">
                Already a member?{" "}
                <Link href="/login" className="text-pink-400 hover:underline">
                  Log in
                </Link>
              </p>
            </div>

            {/* Free preview section */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-white mb-4">
                Free Videos
              </h3>
              <p className="text-white/60 text-sm mb-4">
                Check out our free showcase videos while you decide:
              </p>
              <Link
                href="/free"
                className="inline-block px-4 py-2 rounded-xl bg-green-500/20 border border-green-400/30 text-green-400 text-sm font-medium hover:bg-green-500/30 transition"
              >
                View Free Videos →
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // User has access - show the video
  const relatedVideos = await db.video.findMany({
    where: {
      id: { not: video.id },
      isShowcase: false,
    },
    take: 4,
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-4 md:px-6 pb-10">
        <Link
          href="/videos"
          className="text-gray-400 hover:text-white mb-4 md:mb-6 inline-block text-sm"
        >
          ← Back to Videos
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Main Video */}
          <div className="lg:col-span-2">
            <div className="aspect-video bg-black rounded-xl overflow-hidden neon-border">
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

            <h1 className="mt-3 md:mt-4 text-lg md:text-2xl font-bold text-white">
              {video.title}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-white/60">
              <span className="text-pink-400 font-medium">Premium</span>
              {video.starsCount > 0 && (
                <span>
                  ★ {video.avgStars.toFixed(1)} ({video.starsCount} ratings)
                </span>
              )}
            </div>

            {/* Star Rating */}
            <div className="mt-4 md:mt-6">
              <StarRating videoId={video.id} />
            </div>

            {/* Comments Section */}
            <Comments videoId={video.id} />
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
          </div>
        </div>
      </div>
    </main>
  );
}
