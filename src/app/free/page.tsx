import Link from "next/link";
import { db } from "@/lib/prisma";
import TopNav from "../components/TopNav";

// Force dynamic rendering - don't prerender at build time
export const dynamic = "force-dynamic";

export default async function FreePage() {
  // Get up to 3 showcase videos
  const showcaseVideos = await db.video.findMany({
    where: { isShowcase: true },
    take: 3,
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-4 md:px-6 pb-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold neon-text mb-3">
            Free Video Showcase
          </h1>
          <p className="text-white/70 max-w-xl mx-auto">
            Preview our curated adult content with these 3 free videos.
            Become a member to unlock the full catalog!
          </p>
        </div>

        {showcaseVideos.length === 0 ? (
          <div className="neon-border rounded-2xl p-8 bg-black/30 text-center">
            <p className="text-white/60 mb-4">
              No showcase videos available at the moment.
            </p>
            <Link
              href="/signup"
              className="inline-block px-6 py-3 rounded-xl bg-pink-500/80 hover:bg-pink-500 text-white font-medium transition"
            >
              Become a Member
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
              {showcaseVideos.map((video, idx) => (
                <Link
                  key={video.id}
                  href={`/free/${video.slug}`}
                  className="neon-border rounded-2xl bg-black/30 overflow-hidden hover:bg-white/5 transition group relative"
                >
                  <div className="absolute top-3 left-3 z-10 bg-green-500/90 px-2 py-1 rounded text-xs text-white font-bold">
                    FREE #{idx + 1}
                  </div>
                  <div className="relative aspect-video bg-black/60">
                    <div className="w-full h-full flex items-center justify-center text-white/30">
                      <svg
                        className="w-16 h-16"
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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="p-3 md:p-4">
                    <h3 className="font-semibold text-white text-sm md:text-base line-clamp-2 group-hover:text-pink-300 transition">
                      {video.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-green-400 font-medium">
                        Free to watch
                      </span>
                      {video.avgStars > 0 && (
                        <span className="text-xs text-yellow-400">
                          ★ {video.avgStars.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="neon-border rounded-2xl p-6 md:p-8 bg-gradient-to-r from-yellow-500/10 via-black/0 to-pink-500/10 text-center">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-3">
                Want More?
              </h2>
              <p className="text-white/70 mb-6 max-w-md mx-auto">
                Unlock our entire video catalog, post comments, rate videos,
                and earn rewards as a Diamond Member.
              </p>
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
            </div>
          </>
        )}
      </div>
    </main>
  );
}
