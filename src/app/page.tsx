import Link from "next/link";
import TopNav from "./components/TopNav";
import { LazyEmbed } from "./components/LazyEmbed";

type Video = {
  id: string;
  title: string;
  category: string;
  durationMin: number;
  rating?: number;
  thumb?: string;
};

const SAMPLE: Video[] = [
  { id: "v1", title: "Sample Video One", category: "Category A", durationMin: 12, rating: 4.6 },
  { id: "v2", title: "Sample Video Two", category: "Category B", durationMin: 28, rating: 4.2 },
  { id: "v3", title: "Sample Video Three", category: "Category A", durationMin: 7, rating: 4.9 },
  { id: "v4", title: "Sample Video Four", category: "Category C", durationMin: 45, rating: 4.0 },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-6 pb-10">
        <section className="neon-border rounded-2xl p-6 bg-black/30">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold neon-text">Browse Videos</h1>
            <p className="text-sm text-white/70">
              Search and filter results. (Framework only — we'll wire real data next.)
            </p>
          </div>

          {/* Filters Row */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5">
              <label className="block text-xs text-white/70 mb-1">Search</label>
              <input
                className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white placeholder:text-white/40"
                placeholder="Search titles, tags…"
                defaultValue=""
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs text-white/70 mb-1">Category</label>
              <select className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white">
                <option value="all">All</option>
                <option value="Category A">Category A</option>
                <option value="Category B">Category B</option>
                <option value="Category C">Category C</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-white/70 mb-1">Duration</label>
              <select className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white">
                <option value="any">Any</option>
                <option value="short">0–10 min</option>
                <option value="mid">10–30 min</option>
                <option value="long">30+ min</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-white/70 mb-1">Sort</label>
              <select className="w-full rounded-xl bg-black/40 neon-border px-3 py-2 text-white">
                <option value="new">Newest</option>
                <option value="top">Top rated</option>
                <option value="duration">Duration</option>
              </select>
            </div>
          </div>

          {/* Quick actions */}
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Link
              href="/categories"
              className="group flex h-full flex-col justify-between rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 via-black/0 to-emerald-500/5 px-5 py-4 text-white shadow-[0_0_18px_rgba(16,185,129,0.18)] transition hover:-translate-y-0.5 hover:border-emerald-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
            >
              <div>
                <span className="text-xs uppercase tracking-[0.22em] text-white/60">Discover</span>
                <div className="mt-1 text-lg font-semibold">Categories</div>
                <p className="mt-2 text-sm text-white/70">Browse curated topics and collections.</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                Explore
                <span className="text-white/60 transition-transform group-hover:translate-x-1">-&gt;</span>
              </span>
            </Link>

            <Link
              href="/signup"
              className="group flex h-full flex-col justify-between rounded-2xl border border-pink-400/30 bg-gradient-to-br from-pink-500/25 via-black/0 to-pink-500/10 px-5 py-4 text-white shadow-[0_0_18px_rgba(255,43,214,0.18)] transition hover:-translate-y-0.5 hover:border-pink-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/70"
            >
              <div>
                <span className="text-xs uppercase tracking-[0.22em] text-white/60">Join</span>
                <div className="mt-1 text-lg font-semibold">Sign up</div>
                <p className="mt-2 text-sm text-white/70">Create your profile and save favorites.</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                Get started
                <span className="text-white/60 transition-transform group-hover:translate-x-1">-&gt;</span>
              </span>
            </Link>

            <Link
              href="/login"
              className="group flex h-full flex-col justify-between rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/20 via-black/0 to-sky-500/10 px-5 py-4 text-white shadow-[0_0_18px_rgba(56,189,248,0.2)] transition hover:-translate-y-0.5 hover:border-sky-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
            >
              <div>
                <span className="text-xs uppercase tracking-[0.22em] text-white/60">Welcome back</span>
                <div className="mt-1 text-lg font-semibold">Login</div>
                <p className="mt-2 text-sm text-white/70">Pick up where you left off.</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                Continue
                <span className="text-white/60 transition-transform group-hover:translate-x-1">-&gt;</span>
              </span>
            </Link>
          </div>
        </section>

        {/* Featured Video */}
        <section className="mt-6 neon-border rounded-2xl p-6 bg-black/30">
          <h2 className="text-lg font-semibold neon-text mb-4">Featured Video</h2>
          <div className="flex justify-center">
            <LazyEmbed viewkey="691a4cb39fd5b" />
          </div>
        </section>

        {/* Results grid */}
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold neon-text">Results</h2>
            <span className="text-sm text-white/60">{SAMPLE.length} items</span>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SAMPLE.map((v) => (
              <Link
                key={v.id}
                href={`/videos/${v.id}`}
                className="neon-border rounded-2xl bg-black/30 p-4 hover:bg-white/5 transition"
              >
                <div className="aspect-video rounded-xl bg-black/40 neon-border flex items-center justify-center text-xs text-white/50">
                  Thumbnail
                </div>

                <div className="mt-3">
                  <div className="font-semibold neon-text">{v.title}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-white/60">
                    <span>{v.category}</span>
                    <span>{v.durationMin} min</span>
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
