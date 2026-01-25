import Link from "next/link";
import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import TopNav from "../components/TopNav";
import VideoSearch from "../components/VideoSearch";
import TrialBanner from "../components/TrialBanner";
import DiamondTeaser from "../components/DiamondTeaser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Adult Videos That Pay Crypto – Watch & Earn on Xessex",
  description:
    "Browse verified adult videos and earn crypto for watching. New videos added daily with weekly reward payouts.",
  alternates: {
    canonical: "/videos",
  },
  openGraph: {
    type: "website",
    url: "https://xessex.me/videos",
    title: "Adult Videos That Pay Crypto – Watch & Earn on Xessex",
    description:
      "Browse verified adult videos and earn crypto for watching. New videos added daily with weekly reward payouts.",
  },
};

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
  rank?: number | null;
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

export default async function VideosPage() {
  const approvedVideos = getApprovedVideos();
  const access = await getAccessContext();
  const canViewPremium = access.canViewAllVideos;

  // Get showcase video slugs and all video ranks from database
  const dbVideos = await db.video.findMany({
    select: { slug: true, rank: true, isShowcase: true },
    orderBy: { rank: "asc" },
  });

  // Create a map of slug -> rank
  const rankMap = new Map(dbVideos.map((v) => [v.slug, v.rank]));
  const showcaseSlugs = dbVideos.filter((v) => v.isShowcase).map((v) => v.slug);

  // Merge rank into approved videos and sort by rank
  const videos = approvedVideos
    .map((v) => ({ ...v, rank: rankMap.get(v.viewkey) ?? null }))
    .sort((a, b) => {
      if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
      if (a.rank !== null) return -1;
      if (b.rank !== null) return 1;
      return 0;
    });

  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-4 md:px-6 pb-10">
        {/* Trial status banner (for trial users) */}
        <TrialBanner />

        {/* Diamond upsell (for trial/member users) */}
        {canViewPremium && <div className="mb-4"><DiamondTeaser /></div>}

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

        <VideoSearch videos={videos} canViewPremium={canViewPremium} showcaseSlugs={showcaseSlugs} />
      </div>
    </main>
  );
}
