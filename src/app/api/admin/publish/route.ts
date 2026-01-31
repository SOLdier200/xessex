import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/lib/prisma";
import { getAllApprovedVideos } from "@/lib/db";
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

  // Step 1: Get approved videos from ALL SQLite databases (embeds + youporn)
  const videos = getAllApprovedVideos();

  // Step 2: Export to approved.json (for homepage/collections)
  const outDir = path.join(process.cwd(), "data");
  const outFile = path.join(outDir, "approved.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(videos, null, 2), "utf8");

  // Step 3: Publish to Supabase
  let published = 0;

  for (const v of videos as any[]) {
    const slug = String(v.viewkey || "").trim();
    if (!slug) continue;

    const title = String(v.title || "(untitled)");
    // Use correct embed URL based on source (youporn vs pornhub)
    const embedUrl = v.source === "youporn"
      ? `https://www.youporn.com/embed/${slug}`
      : `https://www.pornhub.com/embed/${slug}`;
    const thumbnailUrl = v.primary_thumb ? String(v.primary_thumb) : null;
    const sourceViews = asNumber(v.views, 0); // PH views from source
    const tags = tagsToArray(v.tags);

    await db.video.upsert({
      where: { slug },
      create: {
        slug,
        title,
        embedUrl,
        thumbnailUrl,
        tags,
        sourceViews,
        unlockCost: 10, // Default cost for new videos (10 credits)
      },
      update: {
        title,
        embedUrl,
        thumbnailUrl,
        tags,
        sourceViews,
        // Don't update unlockCost - preserve existing value
      },
    });

    published++;
  }

  return NextResponse.json({ ok: true, approved: videos.length, exported: videos.length, published });
}
