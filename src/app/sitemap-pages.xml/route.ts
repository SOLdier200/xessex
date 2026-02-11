import { NextResponse } from "next/server";

const base = "https://xessex.me";

// Static pages only - NO signup/login/age
const PAGES = [
  { loc: `${base}/`, changefreq: "daily", priority: "1.0" },
  { loc: `${base}/videos`, changefreq: "daily", priority: "0.9" },
  { loc: `${base}/collections`, changefreq: "daily", priority: "0.9" },
  { loc: `${base}/stars`, changefreq: "weekly", priority: "0.8" },
  { loc: `${base}/leaderboard`, changefreq: "daily", priority: "0.7" },
  { loc: `${base}/earn-crypto-watching-porn`, changefreq: "monthly", priority: "0.7" },
  { loc: `${base}/rewards-drawing`, changefreq: "weekly", priority: "0.6" },
  { loc: `${base}/faq`, changefreq: "monthly", priority: "0.4" },
  { loc: `${base}/launch`, changefreq: "monthly", priority: "0.4" },
  { loc: `${base}/tokenomics`, changefreq: "monthly", priority: "0.4" },
  { loc: `${base}/terms`, changefreq: "yearly", priority: "0.2" },
  { loc: `${base}/privacy`, changefreq: "yearly", priority: "0.2" },
  { loc: `${base}/parental-controls`, changefreq: "yearly", priority: "0.2" },
  { loc: `${base}/contact`, changefreq: "yearly", priority: "0.2" },
  { loc: `${base}/2257`, changefreq: "yearly", priority: "0.2" },
];

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET() {
  const lastmod = process.env.BUILD_TIME;
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    PAGES.map(
      (p) => `
  <url>
    <loc>${xmlEscape(p.loc)}</loc>${lastmodTag}
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    ).join("") +
    `</urlset>`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
