import Link from "next/link";
import Image from "next/image";
import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import TopNav from "../components/TopNav";

export const metadata: Metadata = {
  title: "Adult Video Collections – Curated Categories on Xessex",
  description:
    "Explore curated adult video collections. Discover verified videos and earn crypto rewards while watching.",
  alternates: {
    canonical: "/collections",
  },
  openGraph: {
    type: "website",
    url: "https://xessex.me/collections",
    title: "Adult Video Collections – Curated Categories on Xessex",
    description:
      "Explore curated adult video collections. Discover verified videos and earn crypto rewards while watching.",
  },
};

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

const R2_BASE = "https://pub-77b523433fb04971ba656a572f298a11.r2.dev";

const CATEGORIES = [
  { slug: "blonde", name: "Blonde", image: `${R2_BASE}/blonde.jpg` },
  { slug: "brunette", name: "Brunette", image: `${R2_BASE}/brunette.jpg` },
  { slug: "blowjob", name: "Blowjob", image: `${R2_BASE}/blowjob.jpg` },
  { slug: "threesome", name: "Threesome", image: `${R2_BASE}/threesome2.png` },
  { slug: "anal", name: "Anal", image: `${R2_BASE}/anal23.png` },
  { slug: "asian", name: "Asian", image: `${R2_BASE}/asian.jpg` },
  { slug: "2d", name: "2D Animated", image: `${R2_BASE}/2dpic.webp` },
];

export default function CategoriesPage() {
  const videos = getApprovedVideos();

  // Count videos per category
  const getCategoryCount = (slug: string): number => {
    if (slug === "2d") {
      // 2D Animated matches "cartoon" or "hentai" categories
      return videos.filter((v) => {
        const cats = v.categories?.toLowerCase() ?? "";
        return cats.includes("cartoon") || cats.includes("hentai");
      }).length;
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
          <Image src="/logos/textlogo/siteset3/collect1001.png" alt="Collections" width={938} height={276} priority fetchPriority="high" className="h-[50px] md:h-[65px] w-auto" />
          <p className="mt-2 text-sm text-white/70">
            Browse videos by collection
          </p>
          <p className="mt-2 text-sm text-white/60">
            <span className="text-white/80 font-medium">Unlock videos:</span>{" "}
            New here? Get a Solana Wallet ({" "}
            <a href="https://phantom.app/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">
              Phantom
            </a>{" "}
            /{" "}
            <a href="https://solflare.com/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 underline">
              Solflare
            </a>{" "}
            /{" "}
            <a href="https://backpack.app/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">
              Backpack
            </a>{" "}
            ) then{" "}
            <Link href="/login/diamond" className="text-pink-400 hover:text-pink-300 underline">
              connect your wallet
            </Link>{" "}
            to unlock videos, or learn how to{" "}
            <Link href="/earn-crypto-watching-porn" className="text-pink-400 hover:text-pink-300 underline">
              earn crypto rewards
            </Link>{" "}
            while watching.
          </p>
        </section>

        <div className="mt-4 md:mt-6 flex flex-wrap items-start gap-3 md:gap-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              className={`neon-border rounded-xl bg-black/30 hover:bg-white/5 active:bg-white/10 transition group ${c.image ? "inline-block" : "inline-flex items-center px-4 py-3 md:px-6 md:py-4"}`}
            >
              {c.image ? (
                <div className="p-2">
                  <img
                    src={c.image}
                    alt={c.name}
                    className="w-28 md:w-36 h-36 md:h-44 object-cover rounded-lg"
                  />
                  <div className="mt-2 text-center">
                    <div className="font-semibold text-sm text-white group-hover:text-pink-300 transition">
                      {c.name}
                    </div>
                    <div className="text-[10px] text-white/60">
                      {getCategoryCount(c.slug)}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="font-semibold text-sm md:text-lg text-white group-hover:text-pink-300 transition">
                    {c.name}
                  </div>
                  <div className="ml-3 text-[10px] md:text-xs text-white/60">
                    {getCategoryCount(c.slug)}
                  </div>
                </>
              )}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
