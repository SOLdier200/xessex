import Link from "next/link";
import TopNav from "./components/TopNav";

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
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="rounded-xl bg-white text-black font-medium px-4 py-2 hover:opacity-90">
              Create account
            </Link>
            <Link href="/login" className="neon-border rounded-xl px-4 py-2 hover:bg-white/5">
              Login
            </Link>
            <Link href="/categories" className="neon-border rounded-xl px-4 py-2 hover:bg-white/5">
              Browse categories
            </Link>
          </div>
        </section>

        {/* Featured Video */}
        <section className="mt-6 neon-border rounded-2xl p-6 bg-black/30">
          <h2 className="text-lg font-semibold neon-text mb-4">Featured Video</h2>
          <div className="flex justify-center">
            <div className="w-full max-w-2xl aspect-video">
              <iframe
                src="https://www.pornhub.com/embed/691a4cb39fd5b"
                frameBorder="0"
                width="100%"
                height="100%"
                scrolling="no"
                allowFullScreen
                className="rounded-xl"
              ></iframe>
            </div>
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
