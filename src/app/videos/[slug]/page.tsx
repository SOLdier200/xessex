import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Script from "next/script";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { getVideoAccessWithData } from "@/lib/videoAccess";
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

  const video = await db.video.findFirst({
    where: { slug },
    select: { slug: true, title: true, thumbnailUrl: true },
  });
  if (!video) {
    return {
      title: "Video not found – Xessex",
      alternates: { canonical: "/videos" },
      robots: { index: false, follow: true },
    };
  }

  const canonical = absUrl(`/videos/${video.slug}`);
  // Yandex-optimized: keyword-focused, 50-60 chars
  const title = `${video.title} – Adult Video with Crypto Rewards`;
  // Yandex-optimized: 140-160 chars, literal phrase
  const description = `Watch ${video.title}. Earn crypto rewards for watching verified adult content on Xessex. Updated weekly with new videos.`;
  const image = video.thumbnailUrl ? absUrl(video.thumbnailUrl) : absUrl("/og.jpg");

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title,
      description,
      images: [{ url: image }],
      // SECURITY: Never include embedUrl in OG metadata — generateMetadata
      // cannot check user session, so it would leak playback URLs for locked videos.
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

  // Run access context and video fetch in parallel
  const [ctx, video] = await Promise.all([
    getAccessContext(),
    db.video.findFirst({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        embedUrl: true,
        thumbnailUrl: true,
        viewsCount: true,
        sourceViews: true,
        avgStars: true,
        starsCount: true,
        unlockCost: true,
        kind: true,
        createdAt: true,
        rank: true,
      },
    }),
  ]);

  if (!video) notFound();

  // Run access check and related videos in parallel
  const [access, allRelated] = await Promise.all([
    getVideoAccessWithData({
      videoId: video.id,
      userId: ctx.user?.id ?? null,
      isAdminOrMod: ctx.isAdminOrMod,
      creditBalance: ctx.creditBalance,
      videoKind: video.kind,
      videoUnlockCost: video.unlockCost,
    }),
    db.video.findMany({
      where: {
        id: { not: video.id },
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        thumbnailUrl: true,
        avgStars: true,
        viewsCount: true,
      },
      take: 20,
    }),
  ]);

  // SECURITY: Only expose embedUrl if user has access (unlocked or free video)
  const canEmbed = !!(access?.ok && access?.unlocked);
  const safeEmbedUrl = canEmbed ? (video.embedUrl ?? "") : "";

  // All authenticated users can comment/rate/vote
  const canRateStars = !!ctx.user && ctx.canRateStars;
  const canPostComment = !!ctx.user && ctx.canComment;
  const canVoteComments = !!ctx.user && ctx.canVoteComments;

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
            // SECURITY: Only include embedUrl if user has access
            ...(canEmbed && video.embedUrl ? { embedUrl: video.embedUrl } : {}),
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
      {/* SECURITY: Only render noscript iframe if user has access */}
      {canEmbed && video.embedUrl ? (
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
      ) : null}
      <VideoPlayback
        initialVideo={{
          id: video.id,
          slug: video.slug,
          title: video.title,
          // SECURITY: Only pass embedUrl if user has access
          embedUrl: safeEmbedUrl,
          viewsCount: video.viewsCount,
          sourceViews: video.sourceViews,
          avgStars: video.avgStars,
          starsCount: video.starsCount,
          unlockCost: video.unlockCost,
          thumbnailUrl: video.thumbnailUrl,
          rank: video.rank,
          kind: video.kind,
        }}
        relatedVideos={relatedVideos}
        canRateStars={canRateStars}
        canPostComment={canPostComment}
        canVoteComments={canVoteComments}
        isAuthed={ctx.isAuthed}
        hasWallet={ctx.hasWallet}
        creditBalance={ctx.creditBalance}
        access={access}
        isAdminOrMod={ctx.isAdminOrMod}
      />
    </main>
  );
}
