import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import TopNav from "../components/TopNav";

const prisma = new PrismaClient();

export default async function VideosPage() {
  const videos = await prisma.video.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10">
        <h1 className="text-2xl font-bold neon-text mb-6">Videos</h1>

        {videos.length === 0 ? (
          <p className="text-white/60">No videos yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <Link
                key={v.id}
                href={`/videos/${v.slug}`}
                className="rounded-xl border border-white/15 bg-black/60 p-4 hover:border-pink-400/60 transition"
              >
                <div className="text-white font-semibold">{v.title}</div>
                <div className="text-xs text-white/60 mt-1">
                  {v.isPremium ? (
                    <span className="text-pink-400">Premium</span>
                  ) : (
                    <span className="text-green-400">Free</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
