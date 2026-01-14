import { notFound } from "next/navigation";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import TopNav from "../../components/TopNav";
import VideoPlayback from "./VideoPlayback";

export const dynamic = "force-dynamic";

interface VideoPageProps {
  params: Promise<{ slug: string }>;
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { slug } = await params;
  const access = await getAccessContext();

  const video = await db.video.findFirst({
    where: { slug },
  });

  if (!video) notFound();

  const canViewPremium = access.canViewAllVideos;

  // Hard gate: premium videos 404 for free users (no title leak)
  if (!video.isShowcase && !canViewPremium) {
    notFound();
  }

  // Tier-aware engagement permissions
  const canRateStars = !!access.user && access.canRateStars; // diamond-only
  const canPostComment = !!access.user && access.canComment; // diamond-only
  const canVoteComments = !!access.user && access.canVoteComments; // paid+

  // Get related videos for sidebar
  const relatedVideos = await db.video.findMany({
    where: {
      id: { not: video.id },
      // Show showcase to everyone, premium only to paid
      ...(canViewPremium ? {} : { isShowcase: true }),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      thumbnailUrl: true,
      avgStars: true,
    },
    take: 4,
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen">
      <TopNav />
      <VideoPlayback
        initialVideo={{
          id: video.id,
          slug: video.slug,
          title: video.title,
          embedUrl: video.embedUrl,
          isShowcase: video.isShowcase,
          viewsCount: video.viewsCount,
          avgStars: video.avgStars,
          starsCount: video.starsCount,
        }}
        relatedVideos={relatedVideos}
        canRateStars={canRateStars}
        canPostComment={canPostComment}
        canVoteComments={canVoteComments}
        canViewPremium={canViewPremium}
        isAdminOrMod={access.isAdminOrMod}
      />
    </main>
  );
}
