import Link from "next/link";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import TopNav from "../components/TopNav";

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const access = await getAccessContext();
  const canViewPremium = access.canViewAllVideos;

  // Free users only see showcase videos
  const showcaseVideos = await db.video.findMany({
    where: { isShowcase: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  // Premium videos only fetched for paid users
  const premiumVideos = canViewPremium
    ? await db.video.findMany({
        where: { isShowcase: false },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-4 md:px-6 pb-10">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Videos
          </h1>

          {!canViewPremium && (
            <div className="mb-6 neon-border rounded-2xl p-4 bg-black/30">
              <div className="text-white/70 text-sm">
                Free users get 3 showcase videos. Upgrade to unlock the full catalog.
              </div>
              <div className="mt-3 flex gap-2">
                <Link
                  href="/signup"
                  className="px-4 py-2 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 text-yellow-100 text-sm font-semibold transition"
                >
                  Upgrade
                </Link>
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
                >
                  Log in
                </Link>
              </div>
            </div>
          )}

          {/* Showcase (always visible) */}
          <h2 className="text-lg font-semibold neon-text mb-4">Showcase</h2>

          {showcaseVideos.length === 0 ? (
            <div className="text-white/60">No showcase videos configured.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {showcaseVideos.map((v) => (
                <Link
                  key={v.id}
                  href={`/videos/${v.slug}`}
                  className="neon-border rounded-xl bg-black/30 overflow-hidden group"
                >
                  <div className="aspect-video bg-black/60 relative">
                    <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200">
                      FREE
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-semibold text-white line-clamp-2 group-hover:text-pink-300 transition">
                      {v.title}
                    </div>
                    {v.avgStars > 0 && (
                      <div className="mt-1 text-xs text-yellow-400">
                        ★ {v.avgStars.toFixed(1)} ({v.starsCount})
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Premium (ONLY for paid users - no titles shown to free users) */}
          {canViewPremium && (
            <>
              <h2 className="text-lg font-semibold neon-text mt-10 mb-4">
                Premium
              </h2>

              {premiumVideos.length === 0 ? (
                <div className="text-white/60">No premium videos yet.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {premiumVideos.map((v) => (
                    <Link
                      key={v.id}
                      href={`/videos/${v.slug}`}
                      className="neon-border rounded-xl bg-black/30 overflow-hidden group"
                    >
                      <div className="aspect-video bg-black/60 relative">
                        <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 border border-pink-400/30 text-pink-200">
                          PREMIUM
                        </span>
                      </div>
                      <div className="p-3">
                        <div className="text-sm font-semibold text-white line-clamp-2 group-hover:text-pink-300 transition">
                          {v.title}
                        </div>
                        {v.avgStars > 0 && (
                          <div className="mt-1 text-xs text-yellow-400">
                            ★ {v.avgStars.toFixed(1)} ({v.starsCount})
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
