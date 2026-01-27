/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVideos, getStats, getCategories, type CurationStatus, type Cursor, type SortBy, type SortDir, type DbSource } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || undefined;
  const status = (searchParams.get("status") as CurationStatus) || undefined;
  const excludeApproved = searchParams.get("excludeApproved") === "1";
  const favoriteOnly = searchParams.get("favorite") === "1";
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));

  // Database source (embeds or xvidprem)
  const source = (searchParams.get("source") as DbSource) || "embeds";

  // Sort options
  const sortBy = (searchParams.get("sortBy") as SortBy) || "views";
  const sortDir = (searchParams.get("sortDir") as SortDir) || "desc";

  // Keyset cursor from query params
  let cursor: Cursor = null;
  const cursorValue = searchParams.get("cursorValue");
  const cursorViewkey = searchParams.get("cursorViewkey");
  if (cursorValue !== null && cursorViewkey !== null) {
    cursor = { value: parseInt(cursorValue, 10), viewkey: cursorViewkey };
  }

  const result = getVideos({
    search,
    status,
    excludeApproved,
    favoriteOnly,
    cursor,
    limit,
    sortBy,
    sortDir,
    source,
  });

  const stats = getStats(source);
  const categories = getCategories(source);

  return NextResponse.json({
    videos: result.videos,
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
    stats,
    categories,
  });
}
