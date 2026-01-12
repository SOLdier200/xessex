import Link from "next/link";
import Image from "next/image";
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
  { slug: "2d", name: "2D Animated", icon: "🎨" },
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

      <div className="px-4 md:px-6 pb-10">
        <section className="neon-border rounded-2xl p-4 md:p-6 bg-black/30">
          <Image src="/logos/textlogo/collections.png" alt="Collections" width={938} height={276} priority fetchPriority="high" className="h-[50px] md:h-[65px] w-auto" />
          <p className="mt-2 text-sm text-white/70">
            Browse videos by collection
          </p>
        </section>

        <div className="mt-4 md:mt-6 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              className="neon-border rounded-2xl bg-black/30 p-3 md:p-5 hover:bg-white/5 active:bg-white/10 transition group"
            >
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-2xl md:text-3xl">{c.icon}</span>
                <div>
                  <div className="font-semibold text-sm md:text-lg text-white group-hover:text-pink-300 transition">
                    {c.name}
                  </div>
                  <div className="mt-0.5 md:mt-1 text-[10px] md:text-xs text-white/60">
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
