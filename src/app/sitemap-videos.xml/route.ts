import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

const base = "https://xessex.me";

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET() {
  // All videos in Prisma are already approved/public
  const videos = await db.video.findMany({
    select: { slug: true, createdAt: true },
    orderBy: { rank: "asc" },
    take: 50000,
  });

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    videos
      .filter((v) => !!v.slug)
      .map(
        (v) => `
  <url>
    <loc>${xmlEscape(`${base}/videos/${v.slug}`)}</loc>
    <lastmod>${v.createdAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`
      )
      .join("") +
    `</urlset>`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
