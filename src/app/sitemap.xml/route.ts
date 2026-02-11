import { NextResponse } from "next/server";

const base = "https://xessex.me";

export async function GET() {
  const lastmod = process.env.BUILD_TIME;
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${base}/sitemap-pages.xml</loc>${lastmodTag}
  </sitemap>
  <sitemap>
    <loc>${base}/sitemap-videos.xml</loc>${lastmodTag}
  </sitemap>
  <sitemap>
    <loc>${base}/sitemap-collections.xml</loc>${lastmodTag}
  </sitemap>
</sitemapindex>`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
