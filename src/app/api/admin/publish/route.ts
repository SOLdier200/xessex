import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getApprovedVideos } from "@/lib/db";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

function tagsToArray(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
}

function asNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST() {
  const access = await getAccessContext();
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const videos = getApprovedVideos(); // EXACT SAME SOURCE AS EXPORT

  let published = 0;

  for (const v of videos as any[]) {
    const slug = String(v.viewkey || "").trim();
    if (!slug) continue;

    const title = String(v.title || "(untitled)");
    const embedUrl = `https://www.pornhub.com/embed/${slug}`;
    const viewsCount = asNumber(v.views, 0);
    const tags = tagsToArray(v.tags);

    await db.video.upsert({
      where: { slug },
      create: {
        slug,
        title,
        embedUrl,
        tags,
        viewsCount,
        isShowcase: false, // publish defaults to premium; ShowcaseModal sets showcase
      },
      update: {
        title,
        embedUrl,
        tags,
        viewsCount,
      },
    });

    published++;
  }

  return NextResponse.json({ ok: true, approved: videos.length, published });
}
