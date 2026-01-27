import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Host: xessex.me",
    "Sitemap: https://xessex.me/sitemap.xml",
    "",
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
