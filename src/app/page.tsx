import Link from "next/link";
import fs from "fs";
import path from "path";
import TopNav from "./components/TopNav";
import WalletStatus from "./components/WalletStatus";

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

export default function HomePage() {
  const videos = getApprovedVideos();

  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-4 md:px-6 pb-10">
        <div className="mb-6">
          <WalletStatus />
        </div>

        <section className="neon-border rounded-2xl p-4 md:p-6 bg-black/30">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold neon-text">Browse Videos</h1>
            <p className="text-sm text-white/70">
              {videos.length} curated videos available
            </p>
          </div>

          {/* Filters Row */}
          <div className="mt-5 grid grid-cols-2 md:grid-cols-12 gap-3">
            <div className="col-span-2 md:col-span-5">
              <label className="block text-xs text-white/70 mb-1">Search</label>
              <input
                className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white placeholder:text-white/40 text-sm"
                placeholder="Search titles, tags…"
                defaultValue=""
              />
            </div>

            <div className="col-span-2 md:col-span-3">
              <label className="block text-xs text-white/70 mb-1">Collections</label>
              <select className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white text-sm">
                <option value="all">All</option>
                <option value="blowjob">Blowjob</option>
                <option value="threesome">Threesome</option>
                <option value="for-women">For Women</option>
                <option value="anal">Anal</option>
                <option value="highest-rated">Highest Rated</option>
                <option value="newest">Newest</option>
              </select>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs text-white/70 mb-1">Duration</label>
              <select className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white text-sm">
                <option value="any">Any</option>
                <option value="short">0–10 min</option>
                <option value="mid">10–30 min</option>
                <option value="long">30+ min</option>
              </select>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs text-white/70 mb-1">Sort</label>
              <select className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white text-sm">
                <option value="new">Newest</option>
                <option value="top">Top rated</option>
                <option value="duration">Duration</option>
              </select>
            </div>
          </div>

          {/* Quick actions */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
            <Link
              href="/categories"
              className="group flex h-full flex-col justify-between rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 via-black/0 to-emerald-500/5 px-3 py-3 md:px-5 md:py-4 text-white shadow-[0_0_18px_rgba(16,185,129,0.18)] transition hover:-translate-y-0.5 hover:border-emerald-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
            >
              <div>
                <span className="text-xs uppercase tracking-[0.22em] text-white/60">Discover</span>
                <div className="mt-1 text-lg font-semibold">Collections</div>
                <p className="mt-2 text-sm text-white/70">Evaluate content from different Collections.</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                Explore
              </span>
            </Link>

            <Link
              href="/signup"
              className="group flex h-full flex-col justify-between rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-yellow-500/25 via-black/0 to-yellow-500/10 px-3 py-3 md:px-5 md:py-4 text-white shadow-[0_0_18px_rgba(234,179,8,0.18)] transition hover:-translate-y-0.5 hover:border-yellow-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
            >
              <div>
                <span className="text-xs uppercase tracking-[0.22em] text-yellow-400/80">Earn Money</span>
                <div className="mt-1 text-lg font-semibold">Register as Diamond Member</div>
                <p className="mt-2 text-sm text-white/70">Start earning <span className="text-green-400 font-bold">$</span> for viewing and grading content!</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                Join Now
              </span>
            </Link>

            <Link
              href="/login"
              className="group flex h-full flex-col justify-between rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/20 via-black/0 to-sky-500/10 px-3 py-3 md:px-5 md:py-4 text-white shadow-[0_0_18px_rgba(56,189,248,0.2)] transition hover:-translate-y-0.5 hover:border-sky-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
            >
              <div>
                <span className="text-xs uppercase tracking-[0.22em] text-white/60">Diamond Member</span>
                <div className="mt-1 text-lg font-semibold">Diamond Member Login</div>
                <p className="mt-2 text-sm text-white/70">One-click sign in for Ultimate Access!</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                Diamond Connect
              </span>
            </Link>

            <Link
              href="/leaderboard"
              className="group flex h-full flex-col justify-between rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-500/20 via-black/0 to-purple-500/10 px-3 py-3 md:px-5 md:py-4 text-white shadow-[0_0_18px_rgba(168,85,247,0.2)] transition hover:-translate-y-0.5 hover:border-purple-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/70"
            >
              <div>
                <span className="text-xs uppercase tracking-[0.22em] text-purple-400/80">Leaderboard</span>
                <div className="mt-1 text-lg font-semibold">Diamond Ladder</div>
                <p className="mt-2 text-sm text-white/70">See top ranked Diamond Members!</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                View Rankings
              </span>
            </Link>
          </div>
        </section>

        {/* Featured & Top Ranked Videos */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Featured Video */}
          {videos.length > 0 && videos[0].favorite === 1 && (
            <section className="neon-border rounded-2xl p-4 md:p-6 bg-black/30">
              <h2 className="text-lg font-semibold neon-text mb-4">Featured Video</h2>
              <Link href={`/videos/${videos[0].viewkey}`} className="block w-full">
                <div className="relative aspect-video rounded-xl overflow-hidden">
                  {videos[0].primary_thumb && (
                    <img
                      src={videos[0].primary_thumb}
                      alt={videos[0].title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-sm text-white">
                    {formatDuration(videos[0].duration)}
                  </div>
                  <div className="absolute bottom-2 left-2 bg-pink-500/80 px-2 py-1 rounded text-sm text-white font-semibold">
                    Featured
                  </div>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white hover:text-pink-300 transition">
                  {videos[0].title}
                </h3>
                <p className="mt-1 text-sm text-white/60">
                  {videos[0].performers || "Unknown"} • {formatViews(videos[0].views)} views
                </p>
              </Link>
            </section>
          )}

          {/* Top Ranked Video */}
          {videos.length > 0 && (() => {
            const topRanked = [...videos].sort((a, b) => (b.views || 0) - (a.views || 0))[0];
            return (
              <section className="neon-border rounded-2xl p-4 md:p-6 bg-black/30 border-yellow-400/30">
                <h2 className="text-lg font-semibold text-yellow-400 mb-4">Top Ranked Video</h2>
                <Link href={`/videos/${topRanked.viewkey}`} className="block w-full">
                  <div className="relative aspect-video rounded-xl overflow-hidden">
                    {topRanked.primary_thumb && (
                      <img
                        src={topRanked.primary_thumb}
                        alt={topRanked.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                      />
                    )}
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-sm text-white">
                      {formatDuration(topRanked.duration)}
                    </div>
                    <div className="absolute bottom-2 left-2 bg-yellow-500/80 px-2 py-1 rounded text-sm text-black font-semibold">
                      #1 Ranked
                    </div>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-white hover:text-yellow-300 transition">
                    {topRanked.title}
                  </h3>
                  <p className="mt-1 text-sm text-white/60">
                    {topRanked.performers || "Unknown"} • {formatViews(topRanked.views)} views
                  </p>
                </Link>
              </section>
            );
          })()}
        </div>

        {/* Results grid */}
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold neon-text">All Videos</h2>
            <span className="text-sm text-white/60">{videos.length} videos</span>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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

                <div className="p-2 md:p-3">
                  <div className="font-semibold text-white text-xs md:text-sm line-clamp-2 group-hover:text-pink-300 transition">
                    {v.title}
                  </div>
                  <div className="mt-1 md:mt-2 text-[10px] md:text-xs text-white/60 truncate">
                    {v.performers || "Unknown"}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] md:text-xs text-white/50">
                    <span>{formatViews(v.views)} views</span>
                    <span className="truncate ml-1">{v.categories?.split(";")[0]}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
