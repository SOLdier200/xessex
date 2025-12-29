import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import TopNav from "../../components/TopNav";
import { getCurrentUser, isSubscriptionActive } from "@/lib/auth";

const prisma = new PrismaClient();

interface VideoPageProps {
  params: Promise<{ slug: string }>;
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { slug } = await params;
  const video = await prisma.video.findUnique({ where: { slug } });

  if (!video) {
    return (
      <main className="min-h-screen">
        <TopNav />
        <div className="px-6 py-12 text-center">
          <h1 className="text-2xl font-bold text-white">Video not found</h1>
          <Link href="/" className="text-pink-400 hover:underline mt-4 inline-block">
            Go back home
          </Link>
        </div>
      </main>
    );
  }

  // Free videos: always viewable
  if (!video.isPremium) {
    return (
      <main className="min-h-screen">
        <TopNav />
        <div className="px-6 pb-10">
          <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
            ← Back to Home
          </Link>

          <h1 className="text-2xl font-bold neon-text">{video.title}</h1>
          <p className="text-green-400 text-sm mt-1">Free video</p>

          <div className="mt-6">
            <video controls className="w-full max-w-3xl rounded-xl" src={video.url} />
          </div>

          <div className="mt-8 text-white/70">
            Comments (paid feature) will appear here.
          </div>
        </div>
      </main>
    );
  }

  // Premium video: requires subscription
  const user = await getCurrentUser();
  const active = isSubscriptionActive(user);

  if (!user) {
    return (
      <main className="min-h-screen">
        <TopNav />
        <div className="px-6 pb-10">
          <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
            ← Back to Home
          </Link>

          <h1 className="text-2xl font-bold neon-text">{video.title}</h1>
          <p className="text-pink-400 text-sm mt-1">Premium video</p>

          <div className="mt-6 rounded-2xl border border-white/15 bg-black/60 p-6 max-w-xl">
            <p className="text-white/80">This video is premium.</p>
            <p className="text-white/60 mt-2">
              Connect your wallet to subscribe and unlock all premium content.
            </p>
            <Link
              className="inline-block mt-4 rounded-xl bg-pink-500 px-4 py-2 font-semibold text-black hover:bg-pink-400"
              href="/login"
            >
              Wallet Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!active) {
    return (
      <main className="min-h-screen">
        <TopNav />
        <div className="px-6 pb-10">
          <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
            ← Back to Home
          </Link>

          <h1 className="text-2xl font-bold neon-text">{video.title}</h1>
          <p className="text-pink-400 text-sm mt-1">Premium video</p>

          <div className="mt-6 rounded-2xl border border-white/15 bg-black/60 p-6 max-w-xl">
            <p className="text-white/80">Subscription required to watch premium videos.</p>
            <Link
              className="inline-block mt-4 rounded-xl bg-pink-500 px-4 py-2 font-semibold text-black hover:bg-pink-400"
              href="/subscribe"
            >
              Subscribe with crypto
            </Link>
            <p className="text-xs text-white/50 mt-3">
              You can still browse free videos without a subscription.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Premium unlocked
  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10">
        <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
          ← Back to Home
        </Link>

        <h1 className="text-2xl font-bold neon-text">{video.title}</h1>
        <p className="text-pink-400 text-sm mt-1">Premium unlocked</p>

        <div className="mt-6">
          <video controls className="w-full max-w-3xl rounded-xl" src={video.url} />
        </div>

        <div className="mt-8 text-white/70">
          Comments (paid feature) will appear here.
        </div>
      </div>
    </main>
  );
}
