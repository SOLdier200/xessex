import Link from "next/link";
import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { getUnlockCostForNext } from "@/lib/unlockPricing";
import TopNav from "../components/TopNav";
import VideoSearch from "../components/VideoSearch";

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
  // In wallet-native model, all authenticated users can view content
  const isAuthed = access.isAuthed;

  // Get free video slugs and all video ranks from database
  const dbVideos = await db.video.findMany({
    select: { id: true, slug: true, rank: true, unlockCost: true, thumbnailUrl: true },
    orderBy: { rank: "asc" },
  });

  // Create a map of slug -> rank
  const rankMap = new Map(dbVideos.map((v) => [v.slug, v.rank]));
  const thumbMap = new Map(dbVideos.map((v) => [v.slug, v.thumbnailUrl]));
  const freeSlugs = dbVideos.filter((v) => v.unlockCost === 0).map((v) => v.slug);
  // Create a map of slug -> video ID for playlist feature
  const videoIdMap: Record<string, string> = {};
  for (const v of dbVideos) {
    videoIdMap[v.slug] = v.id;
  }

  // Get user's unlocked videos if authenticated
  let unlockedSlugs: string[] = [];
  let unlockedCount = 0;
  if (access.user?.id) {
    const userUnlocks = await db.videoUnlock.findMany({
      where: { userId: access.user.id },
      select: { video: { select: { slug: true } } },
    });
    unlockedSlugs = userUnlocks.map((u) => u.video.slug);
    unlockedCount = userUnlocks.length;
  }

  // Calculate next unlock cost from progressive ladder
  const nextCost = getUnlockCostForNext(unlockedCount);

  // Debug: identify why videos may appear unlocked
  console.log("VIDEOS_LOCK_DEBUG", {
    isAuthed: access.isAuthed,
    isAdminOrMod: access.isAdminOrMod,
    userId: access.user?.id ?? null,
    dbVideos: dbVideos.length,
    freeSlugs: freeSlugs.length,
    unlockedSlugs: unlockedSlugs.length,
    sampleFree: freeSlugs.slice(0, 5),
    sampleUnlocked: unlockedSlugs.slice(0, 5),
  });

  // Only show videos that exist in DB (so unlockCost is known)
  const dbSlugSet = new Set(dbVideos.map((v) => v.slug));

  // Merge rank into approved videos and sort by rank
  const videos = approvedVideos
    .filter((v) => dbSlugSet.has(v.viewkey))
    .map((v) => ({
      ...v,
      rank: rankMap.get(v.viewkey) ?? null,
      primary_thumb: v.primary_thumb || thumbMap.get(v.viewkey) || null,
    }))
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
        {!isAuthed && (
          <div className="mb-6 neon-border rounded-2xl p-4 bg-black/30">
            <div className="text-white/70 text-sm">
              Connect your wallet to unlock videos with Special Credits.
            </div>
            <div className="mt-3 flex gap-2">
              <Link
                href="/login/diamond"
                className="px-4 py-2 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 text-yellow-100 text-sm font-semibold transition"
              >
                Connect Wallet
              </Link>
              <Link
                href="/login/diamond"
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
              >
                Log in
              </Link>
            </div>
          </div>
        )}

        <VideoSearch
          videos={videos}
          isAuthed={isAuthed}
          isAdminOrMod={false}
          freeSlugs={freeSlugs}
          unlockedSlugs={unlockedSlugs}
          creditBalance={access.creditBalance}
          initialUnlockedCount={unlockedCount}
          initialNextCost={nextCost}
          videoIdMap={videoIdMap}
        />
      </div>
    </main>
  );
}
