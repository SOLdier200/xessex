import Link from "next/link";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import TopNav from "../components/TopNav";

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const access = await getAccessContext();
  const canViewPremium = access.canViewAllVideos;

  // Fetch all videos sorted by rank - premium users see all, free users see only showcase
  const videos = await db.video.findMany({
    where: canViewPremium ? {} : { isShowcase: true },
    orderBy: { rank: "asc" },
  });

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

          {/* All Videos sorted by rank */}
          <p className="text-sm text-white/70 mb-4">
            {canViewPremium
              ? "The best videos the internet has to offer, highly curated by our well paid diamond members for your enjoyment!"
              : "Free Videos"}
          </p>

          {videos.length === 0 ? (
            <div className="text-white/60">No videos available.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((v) => (
                <Link
                  key={v.id}
                  href={`/videos/${v.slug}`}
                  className="neon-border rounded-xl bg-black/30 overflow-hidden group"
                >
                  <div className="aspect-video bg-black/60 relative">
                    {v.thumbnailUrl && (
                      <img
                        src={v.thumbnailUrl}
                        alt={v.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {/* Rank Badge */}
                    <span
                      className="absolute top-1.5 left-1.5 min-w-[22px] h-5 flex items-center justify-center text-xs font-bold px-1.5 rounded-md bg-gradient-to-br from-purple-500/40 to-pink-500/40 text-white backdrop-blur-sm shadow-md"
                      style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}
                    >
                      #{v.rank}
                    </span>
                    {v.isShowcase && (
                      <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200">
                        FREE
                      </span>
                    )}
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
        </div>
      </div>
    </main>
  );
}
