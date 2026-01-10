import { NextRequest, NextResponse } from "next/server";
import { getVideos, getStats, getCategories, type CurationStatus, type Cursor } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || undefined;
  const status = (searchParams.get("status") as CurationStatus) || undefined;
  const excludeApproved = searchParams.get("excludeApproved") === "1";
  const favoriteOnly = searchParams.get("favorite") === "1";
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));

  // Keyset cursor from query params
  let cursor: Cursor = null;
  const cursorViews = searchParams.get("cursorViews");
  const cursorViewkey = searchParams.get("cursorViewkey");
  if (cursorViews !== null && cursorViewkey !== null) {
    cursor = { views: parseInt(cursorViews, 10), viewkey: cursorViewkey };
  }

  const result = getVideos({
    search,
    status,
    excludeApproved,
    favoriteOnly,
    cursor,
    limit,
  });

  const stats = getStats();
  const categories = getCategories();

  return NextResponse.json({
    videos: result.videos,
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
    stats,
    categories,
  });
}
