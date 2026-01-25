import { MetadataRoute } from "next";
import { db } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://xessex.me";

  // Fetch all videos (all videos in Prisma are already approved/public)
  const videos = await db.video.findMany({
    select: {
      slug: true,
      createdAt: true,
    },
    orderBy: { rank: "asc" },
    take: 5000, // safe cap for sitemap
  });

  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/collections`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/videos`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/stars`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/leaderboard`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/earn-crypto-watching-porn`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/parental-controls`, changeFrequency: "yearly", priority: 0.2 },

    // Dynamic video pages
    ...videos.map((v) => ({
      url: `${base}/videos/${v.slug}`,
      lastModified: v.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
