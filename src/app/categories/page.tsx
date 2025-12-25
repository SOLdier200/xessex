import Link from "next/link";
import TopNav from "../components/TopNav";

const CATEGORIES = [
  { slug: "category-a", name: "Category A", count: 124 },
  { slug: "category-b", name: "Category B", count: 88 },
  { slug: "category-c", name: "Category C", count: 52 },
  { slug: "new", name: "New & Trending", count: 30 },
];

export default function CategoriesPage() {
  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-6 pb-10">
        <section className="neon-border rounded-2xl p-6 bg-black/30">
          <h1 className="text-2xl font-semibold neon-text">Categories</h1>
          <p className="mt-2 text-sm text-white/70">
            Pick a category to browse. (Framework only — we'll wire real category pages next.)
          </p>
        </section>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="neon-border rounded-2xl bg-black/30 p-5 hover:bg-white/5 transition"
            >
              <div className="font-semibold neon-text">{c.name}</div>
              <div className="mt-2 text-xs text-white/60">{c.count} videos</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
