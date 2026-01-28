import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Proxy for XVideos embeds - strips X-Frame-Options header
 * Only use with permission from content provider
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const viewkey = searchParams.get("v");

  if (!viewkey || !/^[a-z0-9]+$/i.test(viewkey)) {
    return new NextResponse("Invalid viewkey", { status: 400 });
  }

  const embedUrl = `https://www.xvideos.com/embedframe/${viewkey}`;

  try {
    const response = await fetch(embedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.xvideos.com/",
      },
    });

    if (!response.ok) {
      return new NextResponse("Video not found", { status: response.status });
    }

    let html = await response.text();

    // Inject base tag so relative URLs resolve to xvideos.com
    if (!html.includes("<base")) {
      html = html.replace(
        /<head[^>]*>/i,
        '$&<base href="https://www.xvideos.com/">'
      );
    }

    // Return the HTML without X-Frame-Options
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Explicitly NOT setting X-Frame-Options or frame-ancestors
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("XVideos proxy error:", error);
    return new NextResponse("Proxy error", { status: 500 });
  }
}
