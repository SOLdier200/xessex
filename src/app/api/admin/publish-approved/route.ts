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
  source?: "embeds" | "youporn"; // Database source from export
};

function toTagsArray(tags?: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Get embed platform from database source
 * - embeds = PornHub
 * - youporn = YouPorn
 */
function getEmbedPlatform(row: ApprovedRow): "pornhub" | "youporn" {
  // If source is explicitly set, use it
  if (row.source === "youporn") return "youporn";
  if (row.source === "embeds") return "pornhub";

  // Fallback: detect from viewkey pattern
  const viewkey = row.viewkey?.trim() || "";

  // PornHub viewkeys start with "ph" or are hex-like
  if (viewkey.startsWith("ph") || /^[0-9a-f]{13,}$/i.test(viewkey)) {
    return "pornhub";
  }

  // YouPorn viewkeys are typically numeric
  return "youporn";
}

function getEmbedUrl(viewkey: string, source: "pornhub" | "youporn"): string {
  if (source === "youporn") {
    return `https://www.youporn.com/embed/${viewkey}`;
  }
  return `https://www.pornhub.com/embed/${viewkey}`;
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

  for (const row of parsed) {
    const viewkey = row.viewkey?.trim();
    if (!viewkey) {
      skipped++;
      continue;
    }

    const title = (row.title || "").trim() || viewkey;
    const platform = getEmbedPlatform(row);
    const embedUrl = getEmbedUrl(viewkey, platform);
    const tags = toTagsArray(row.tags);
    const sourceViews = Number(row.views || 0) || 0;
    const thumbnailUrl = row.primary_thumb || null;

    await db.video.upsert({
      where: { slug: viewkey },
      create: {
        slug: viewkey,
        title,
        embedUrl,
        tags,
        sourceViews,
        thumbnailUrl,
      },
      update: {
        title,
        embedUrl,
        tags,
        sourceViews,
        thumbnailUrl,
      },
    });

    upserted++;
  }

  return NextResponse.json({ ok: true, upserted, skipped });
}
