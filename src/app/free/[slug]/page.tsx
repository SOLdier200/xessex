import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/prisma";
import TopNav from "../../components/TopNav";
import StarRating from "../../components/StarRating";
import Comments from "../../components/Comments";

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface FreeVideoPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FreeVideoPage({ params }: FreeVideoPageProps) {
  const { slug } = await params;

  // Only show if it's a showcase video
  const video = await db.video.findFirst({
    where: {
      slug,
      isShowcase: true,
    },
  });

  if (!video) {
    notFound();
  }

  // Get other showcase videos for sidebar
  const otherShowcase = await db.video.findMany({
    where: {
      isShowcase: true,
      id: { not: video.id },
    },
    take: 2,
  });

  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-4 md:px-6 pb-10">
        <Link
          href="/free"
          className="text-gray-400 hover:text-white mb-4 md:mb-6 inline-block text-sm"
        >
          ← Back to Free Videos
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Main Video */}
          <div className="lg:col-span-2">
            <div className="aspect-video bg-black rounded-xl overflow-hidden neon-border relative">
              <div className="absolute top-3 left-3 z-10 bg-green-500/90 px-2 py-1 rounded text-xs text-white font-bold">
                FREE
              </div>
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
              <span className="text-green-400 font-medium">Free Showcase</span>
              {video.starsCount > 0 && (
                <span>
                  ★ {video.avgStars.toFixed(1)} ({video.starsCount} ratings)
                </span>
              )}
            </div>

            {/* Star Rating - Diamond only */}
            <div className="mt-4 md:mt-6">
              <StarRating videoId={video.id} />
            </div>

            {/* Comments Section */}
            <Comments videoId={video.id} />

            {/* CTA to upgrade */}
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-yellow-500/20 via-black/0 to-pink-500/20 border border-yellow-400/30">
              <h3 className="text-lg font-semibold text-white mb-2">
                Enjoying this video?
              </h3>
              <p className="text-white/70 text-sm mb-4">
                Become a member to unlock our entire catalog of premium content,
                post comments, and earn rewards!
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/subscribe"
                  className="px-4 py-2 rounded-xl bg-pink-500/80 hover:bg-pink-500 text-white text-sm font-medium transition"
                >
                  Subscribe
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 rounded-xl bg-yellow-500/80 hover:bg-yellow-500 text-black text-sm font-medium transition"
                >
                  Diamond Member
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 mt-4 lg:mt-0">
            <h2 className="text-lg font-semibold neon-text mb-4">
              More Free Videos
            </h2>

            {otherShowcase.length === 0 ? (
              <p className="text-white/50 text-sm">
                No other free videos available.
              </p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:gap-4">
                {otherShowcase.map((v) => (
                  <Link
                    key={v.id}
                    href={`/free/${v.slug}`}
                    className="flex flex-col lg:flex-row gap-2 lg:gap-3 group"
                  >
                    <div className="relative w-full lg:w-32 shrink-0 aspect-video bg-black/60 rounded-lg overflow-hidden">
                      <div className="absolute top-1 left-1 bg-green-500/90 px-1 py-0.5 rounded text-[10px] text-white font-bold">
                        FREE
                      </div>
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
                      <div className="mt-1 text-[10px] lg:text-xs text-green-400">
                        Free to watch
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Membership CTA */}
            <div className="mt-6 p-4 rounded-xl border border-purple-400/30 bg-purple-500/10">
              <h3 className="text-sm font-semibold text-white mb-2">
                Unlock All Videos
              </h3>
              <p className="text-xs text-white/60 mb-3">
                Get access to hundreds of premium videos with a membership.
              </p>
              <Link
                href="/subscribe"
                className="block w-full text-center px-3 py-2 rounded-lg bg-purple-500/80 hover:bg-purple-500 text-white text-sm font-medium transition"
              >
                View Plans
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
