import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Script from "next/script";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import TopNav from "../../components/TopNav";
import VideoPlayback from "./VideoPlayback";

export const dynamic = "force-dynamic";

function siteBase() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://xessex.me").replace(/\/$/, "");
}

function absUrl(pathOrUrl: string) {
  if (!pathOrUrl) return siteBase();
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  return `${siteBase()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

interface VideoPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;

  const video = await db.video.findFirst({ where: { slug } });
  if (!video) return {};

  const url = absUrl(`/videos/${video.slug}`);
  const title = video.title || "Video";
  const description = `Watch ${video.title} on Xessex - Premium Adult Video Platform`;
  const image = video.thumbnailUrl ? absUrl(video.thumbnailUrl) : absUrl("/og.jpg");

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "video.other",
      url,
      title,
      description,
      images: [{ url: image }],
      videos: video.embedUrl
        ? [{ url: video.embedUrl, type: "text/html" }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
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

  // Get related videos for sidebar - fetch more and randomize
  const allRelated = await db.video.findMany({
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
  });

  // Shuffle and take 4 random videos
  const shuffled = allRelated.sort(() => Math.random() - 0.5);
  const relatedVideos = shuffled.slice(0, 4);

  const pageUrl = absUrl(`/videos/${video.slug}`);
  const thumb = video.thumbnailUrl ? absUrl(video.thumbnailUrl) : undefined;
  const description = `Watch ${video.title} on Xessex - Premium Adult Video Platform`;

  return (
    <main className="min-h-screen">
      <TopNav />
      <Script
        id="video-jsonld"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoObject",
            "@id": `${pageUrl}#video`,
            name: video.title || "Video",
            description,
            thumbnailUrl: thumb ? [thumb] : undefined,
            uploadDate: new Date(video.createdAt).toISOString(),
            embedUrl: video.embedUrl,
            contentUrl: pageUrl,
            isFamilyFriendly: false,
            potentialAction: {
              "@type": "WatchAction",
              target: pageUrl,
            },
          }),
        }}
      />
      {/* Server-visible fallback so crawlers can still "see" an embed without JS */}
      <noscript>
        <div style={{ maxWidth: "1152px", margin: "0 auto", padding: "24px 16px" }}>
          <div style={{ aspectRatio: "16 / 9", background: "black", borderRadius: "16px", overflow: "hidden" }}>
            <iframe
              src={video.embedUrl}
              width="100%"
              height="100%"
              frameBorder={0}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              referrerPolicy="origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </noscript>
      <VideoPlayback
        initialVideo={{
          id: video.id,
          slug: video.slug,
          title: video.title,
          embedUrl: video.embedUrl,
          isShowcase: video.isShowcase,
          viewsCount: video.viewsCount,
          sourceViews: video.sourceViews,
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
