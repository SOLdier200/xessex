import Link from "next/link";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import TopNav from "../components/TopNav";

// Force dynamic rendering - don't prerender at build time
export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const access = await getAccessContext();

  // Get all videos
  const videos = await db.video.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Separate showcase and premium videos
  const showcaseVideos = videos.filter((v) => v.isShowcase);
  const premiumVideos = videos.filter((v) => !v.isShowcase);

  const canViewPremium = access.canViewAllVideos;

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-4 md:px-6 pb-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold neon-text">Video Catalog</h1>
            <p className="text-sm text-white/60 mt-1">
              {videos.length} videos available
            </p>
          </div>
          {!canViewPremium && (
            <Link
              href="/subscribe"
              className="px-4 py-2 rounded-xl bg-pink-500/80 hover:bg-pink-500 text-white text-sm font-medium transition"
            >
              Subscribe to Unlock All
            </Link>
          )}
        </div>

        {/* Free Showcase Section */}
        {showcaseVideos.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-green-500/20 text-xs">
                FREE
              </span>
              Showcase Videos
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {showcaseVideos.map((v) => (
                <Link
                  key={v.id}
                  href={`/free/${v.slug}`}
                  className="rounded-xl border border-green-400/30 bg-black/60 p-4 hover:border-green-400/60 transition group"
                >
                  <div className="text-white font-semibold group-hover:text-green-300 transition">
                    {v.title}
                  </div>
                  <div className="text-xs text-green-400 mt-1 flex items-center gap-2">
                    Free to Watch
                    {v.avgStars > 0 && (
                      <span className="text-yellow-400">
                        ★ {v.avgStars.toFixed(1)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Premium Videos Section */}
        <section>
          <h2 className="text-lg font-semibold text-pink-400 mb-4 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-pink-500/20 text-xs">
              PREMIUM
            </span>
            Member Videos
            {!canViewPremium && (
              <span className="text-xs text-white/40 font-normal">
                (Subscribe to unlock)
              </span>
            )}
          </h2>

          {premiumVideos.length === 0 ? (
            <p className="text-white/60">No premium videos yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {premiumVideos.map((v) => (
                <div key={v.id} className="relative">
                  {canViewPremium ? (
                    <Link
                      href={`/videos/${v.slug}`}
                      className="block rounded-xl border border-pink-400/30 bg-black/60 p-4 hover:border-pink-400/60 transition group"
                    >
                      <div className="text-white font-semibold group-hover:text-pink-300 transition">
                        {v.title}
                      </div>
                      <div className="text-xs text-pink-400 mt-1 flex items-center gap-2">
                        Premium
                        {v.avgStars > 0 && (
                          <span className="text-yellow-400">
                            ★ {v.avgStars.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </Link>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-black/60 p-4 opacity-60 relative">
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                        <svg
                          className="w-8 h-8 text-white/30"
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
                      <div className="text-white font-semibold blur-sm">
                        {v.title}
                      </div>
                      <div className="text-xs text-white/40 mt-1">Locked</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Subscribe CTA for non-members */}
        {!canViewPremium && premiumVideos.length > 0 && (
          <div className="mt-8 neon-border rounded-2xl p-6 bg-gradient-to-r from-pink-500/10 via-black/0 to-purple-500/10 text-center">
            <h3 className="text-xl font-bold text-white mb-2">
              Unlock All {premiumVideos.length} Premium Videos
            </h3>
            <p className="text-white/70 mb-4">
              Subscribe now to get unlimited access to our entire catalog.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/subscribe"
                className="px-6 py-3 rounded-xl bg-pink-500/80 hover:bg-pink-500 text-white font-medium transition"
              >
                Subscribe
              </Link>
              <Link
                href="/signup"
                className="px-6 py-3 rounded-xl bg-yellow-500/80 hover:bg-yellow-500 text-black font-medium transition"
              >
                Become Diamond Member
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
