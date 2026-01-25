import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

type ApprovedRow = {
  viewkey: string;
  title?: string | null;
  primary_thumb?: string | null;
  tags?: string | null; // semicolon-separated
  views?: number | null;
};

function toTagsArray(tags?: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function POST() {
  const access = await getAccessContext();
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const filePath = path.join(process.cwd(), "data", "approved.json");
  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { ok: false, error: "MISSING_APPROVED_JSON" },
      { status: 400 }
    );
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as ApprovedRow[];

  let upserted = 0;
  let skipped = 0;

  // NOTE: we do NOT force isShowcase here — showcase is managed by /api/admin/showcase
  for (const row of parsed) {
    const viewkey = row.viewkey?.trim();
    if (!viewkey) {
      skipped++;
      continue;
    }

    const title = (row.title || "").trim() || viewkey;
    const embedUrl = `https://www.pornhub.com/embed/${viewkey}`;
    const tags = toTagsArray(row.tags);
    const sourceViews = Number(row.views || 0) || 0; // PH views from source

    await db.video.upsert({
      where: { slug: viewkey },
      create: {
        slug: viewkey,
        title,
        embedUrl,
        tags,
        sourceViews, // PH views - not viewsCount (which tracks Xessex local views)
        isShowcase: false,
      },
      update: {
        title,
        embedUrl,
        tags,
        sourceViews,
        // do NOT overwrite isShowcase on update
      },
    });

    upserted++;
  }

  return NextResponse.json({ ok: true, upserted, skipped });
}
