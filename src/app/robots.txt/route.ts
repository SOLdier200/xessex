import { NextResponse } from "next/server";

export async function GET() {
  const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /signup
Disallow: /login
Disallow: /age

# Yandex-specific directives
Host: https://xessex.me
Clean-param: utm_source&utm_medium&utm_campaign&utm_term&utm_content /

Sitemap: https://xessex.me/sitemap.xml
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
