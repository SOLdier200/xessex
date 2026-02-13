export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import TopNav from "@/app/components/TopNav";
import { getContentById } from "@/lib/xessexContent";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";
import XessexContentPlayer from "./XessexContentPlayer";

export default async function XessexContentWatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const content = getContentById(id);

  if (!content) notFound();

  const ctx = await getAccessContext();

  // Ensure a Video record exists for this xessex content (needed for ratings, comments, views)
  const video = await db.video.upsert({
    where: { slug: content.id },
    create: {
      slug: content.id,
      title: content.title,
      embedUrl: "",
      mediaUrl: content.videoUrl,
      thumbnailUrl: content.thumbnailUrl,
      kind: "XESSEX",
      unlockCost: content.unlockCost,
      isActive: true,
    },
    update: {
      title: content.title,
      mediaUrl: content.videoUrl,
      thumbnailUrl: content.thumbnailUrl,
    },
    select: {
      id: true,
      viewsCount: true,
      avgStars: true,
      starsCount: true,
      rank: true,
    },
  });

  // Check unlock status
  let unlocked = false;
  let creditBalance = 0;

  if (ctx.user) {
    creditBalance = ctx.creditBalance;

    const existing = await db.specialCreditLedger.findFirst({
      where: {
        refType: "XESSEX_CONTENT_UNLOCK",
        refId: `${ctx.user.id}_${id}`,
      },
      select: { id: true },
    });
    unlocked = !!existing;
  }

  // User permissions
  const canRateStars = !!ctx.user && ctx.canRateStars;
  const canPostComment = !!ctx.user && ctx.canComment;
  const canVoteComments = !!ctx.user && ctx.canVoteComments;

  // Fetch related videos (other active videos, shuffled)
  const allRelated = await db.video.findMany({
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
  });

  const shuffled = allRelated.sort(() => Math.random() - 0.5);
  const relatedVideos = shuffled.slice(0, 4);

  return (
    <main className="min-h-screen">
      <TopNav />
      <XessexContentPlayer
        contentId={content.id}
        videoDbId={video.id}
        title={content.title}
        thumbnailUrl={content.thumbnailUrl}
        videoUrl={unlocked ? content.videoUrl : null}
        unlockCost={content.unlockCost}
        creditBalance={creditBalance}
        isAuthed={ctx.isAuthed}
        hasWallet={ctx.hasWallet}
        unlocked={unlocked}
        canRateStars={canRateStars}
        canPostComment={canPostComment}
        canVoteComments={canVoteComments}
        isAdminOrMod={ctx.isAdminOrMod}
        viewsCount={video.viewsCount}
        avgStars={video.avgStars}
        starsCount={video.starsCount}
        rank={video.rank}
        relatedVideos={relatedVideos}
      />
    </main>
  );
}
