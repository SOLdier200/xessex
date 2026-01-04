import Link from "next/link";
import fs from "fs";
import path from "path";
import TopNav from "../components/TopNav";

type ApprovedVideo = {
  id: number;
  viewkey: string;
  title: string;
  categories: string | null;
  views: number | null;
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

const CATEGORIES = [
  { slug: "blowjob", name: "Blowjob", icon: "💋" },
  { slug: "threesome", name: "Threesome", icon: "👥" },
  { slug: "for-women", name: "For Women", icon: "♀️" },
  { slug: "anal", name: "Anal", icon: "🍑" },
  { slug: "highest-rated", name: "Highest Rated", icon: "⭐" },
  { slug: "newest", name: "Newest", icon: "🆕" },
];

export default function CategoriesPage() {
  const videos = getApprovedVideos();

  // Count videos per category
  const getCategoryCount = (slug: string): number => {
    if (slug === "highest-rated" || slug === "newest") {
      return videos.length; // These show all videos sorted differently
    }
    const categoryName = slug.replace("-", " ");
    return videos.filter((v) =>
      v.categories?.toLowerCase().includes(categoryName)
    ).length;
  };

  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-6 pb-10">
        <section className="neon-border rounded-2xl p-6 bg-black/30">
          <h1 className="text-2xl font-semibold neon-text">Collections</h1>
          <p className="mt-2 text-sm text-white/70">
            Browse videos by collection
          </p>
        </section>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="neon-border rounded-2xl bg-black/30 p-5 hover:bg-white/5 transition group"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{c.icon}</span>
                <div>
                  <div className="font-semibold text-lg text-white group-hover:text-pink-300 transition">
                    {c.name}
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    {getCategoryCount(c.slug)} videos
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
