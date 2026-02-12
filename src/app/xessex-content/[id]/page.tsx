export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import TopNav from "@/app/components/TopNav";
import { getContentById } from "@/lib/xessexContent";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";
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

  let unlocked = false;
  let creditBalance = 0;

  if (ctx.user) {
    creditBalance = ctx.creditBalance;

    if (ctx.isAdminOrMod) {
      unlocked = true;
    } else {
      const existing = await db.specialCreditLedger.findFirst({
        where: {
          refType: "XESSEX_CONTENT_UNLOCK",
          refId: `${ctx.user.id}_${id}`,
        },
        select: { id: true },
      });
      unlocked = !!existing;
    }
  }

  return (
    <main className="min-h-screen">
      <TopNav />
      <XessexContentPlayer
      contentId={content.id}
      title={content.title}
      thumbnailUrl={content.thumbnailUrl}
      videoUrl={unlocked ? content.videoUrl : null}
      unlockCost={content.unlockCost}
      creditBalance={creditBalance}
      isAuthed={ctx.isAuthed}
      hasWallet={ctx.hasWallet}
      unlocked={unlocked}
    />
    </main>
  );
}
