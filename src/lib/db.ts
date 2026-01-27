/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import Database from "better-sqlite3";
import path from "path";

export type DbSource = "embeds" | "xvidprem";

// Database paths - use env vars if set, otherwise local paths
const dbPaths: Record<DbSource, string> = {
  embeds: process.env.DB_PATH || path.join(process.cwd(), "embeds.db"),
  xvidprem: process.env.XVIDPREM_DB_PATH || path.join(process.cwd(), "xvidprem.db"),
};

console.log("[db.ts] Database paths:", dbPaths);

// Connection cache for each database
const dbConnections: Partial<Record<DbSource, Database.Database>> = {};

export function getDb(source: DbSource = "embeds"): Database.Database {
  if (!dbConnections[source]) {
    const dbPath = dbPaths[source];
    dbConnections[source] = new Database(dbPath, { readonly: false });
    dbConnections[source]!.pragma("journal_mode = WAL");
  }
  return dbConnections[source]!;
}

export type Video = {
  id: number;
  viewkey: string;
  title: string | null;
  primary_thumb: string | null;
  duration: number | null;
  views: number | null;
  embed_html: string | null;
  tags: string | null;
  categories: string | null;
  performers: string | null;
};

export type VideoWithCuration = Video & {
  status: string | null;
  note: string | null;
  favorite: number;
};

export type CurationStatus = "pending" | "approved" | "rejected" | "maybe";

export type SortBy = "views" | "duration";
export type SortDir = "desc" | "asc";

// Keyset pagination cursor
export type Cursor = {
  value: number; // The sort column value (views or duration)
  viewkey: string;
} | null;

export type VideoListResult = {
  videos: VideoWithCuration[];
  nextCursor: Cursor;
  hasMore: boolean;
};

/**
 * Get videos with FTS5 search and keyset pagination
 */
export function getVideos(options: {
  search?: string;
  status?: CurationStatus;
  excludeApproved?: boolean;
  favoriteOnly?: boolean;
  cursor?: Cursor;
  limit?: number;
  sortBy?: SortBy;
  sortDir?: SortDir;
  source?: DbSource;
}): VideoListResult {
  const db = getDb(options.source);
  const limit = options.limit || 50;
  const sortBy = options.sortBy || "views";
  const sortDir = options.sortDir || "desc";
  const params: (string | number)[] = [];

  // Build ORDER BY and keyset condition based on sort
  const sortCol = sortBy === "duration" ? "v.duration" : "v.views";
  const sortOp = sortDir === "desc" ? "<" : ">";
  const sortOrder = sortDir === "desc" ? "DESC" : "ASC";
  const viewkeyOrder = sortDir === "desc" ? "ASC" : "DESC"; // Tie-breaker opposite direction

  let sql: string;

  if (options.search && options.search.trim()) {
    // FTS5 search path
    const searchTerm = options.search
      .trim()
      .replace(/[^\w\s]/g, "") // Remove special chars
      .split(/\s+/)
      .map((w) => `${w}*`)
      .join(" ");

    sql = `
      SELECT v.id, v.viewkey, v.title, v.primary_thumb, v.duration, v.views,
             v.embed_html, v.tags, v.categories, v.performers,
             COALESCE(c.status, 'pending') as status, c.note, COALESCE(c.favorite, 0) as favorite
      FROM videos_fts f
      JOIN videos v ON v.id = f.rowid
      LEFT JOIN curation c ON c.viewkey = v.viewkey
      WHERE videos_fts MATCH ?
    `;
    params.push(searchTerm);

    // Status filter
    if (options.status) {
      if (options.status === "pending") {
        sql += ` AND (c.status IS NULL OR c.status = 'pending')`;
      } else {
        sql += ` AND c.status = ?`;
        params.push(options.status);
      }
    }

    // Exclude approved filter (for main curation view)
    if (options.excludeApproved) {
      sql += ` AND (c.status IS NULL OR c.status != 'approved')`;
    }

    // Favorite filter
    if (options.favoriteOnly) {
      sql += ` AND c.favorite = 1`;
    }

    // Keyset pagination
    if (options.cursor) {
      const viewkeyOp = sortDir === "desc" ? ">" : "<";
      sql += ` AND (${sortCol} ${sortOp} ? OR (${sortCol} = ? AND v.viewkey ${viewkeyOp} ?))`;
      params.push(options.cursor.value, options.cursor.value, options.cursor.viewkey);
    }

    sql += ` ORDER BY ${sortCol} ${sortOrder}, v.viewkey ${viewkeyOrder} LIMIT ?`;
    params.push(limit + 1); // Fetch one extra to check hasMore
  } else {
    // No search - direct query
    sql = `
      SELECT v.id, v.viewkey, v.title, v.primary_thumb, v.duration, v.views,
             v.embed_html, v.tags, v.categories, v.performers,
             COALESCE(c.status, 'pending') as status, c.note, COALESCE(c.favorite, 0) as favorite
      FROM videos v
      LEFT JOIN curation c ON c.viewkey = v.viewkey
      WHERE 1=1
    `;

    // Status filter
    if (options.status) {
      if (options.status === "pending") {
        sql += ` AND (c.status IS NULL OR c.status = 'pending')`;
      } else {
        sql += ` AND c.status = ?`;
        params.push(options.status);
      }
    }

    // Exclude approved filter (for main curation view)
    if (options.excludeApproved) {
      sql += ` AND (c.status IS NULL OR c.status != 'approved')`;
    }

    // Favorite filter
    if (options.favoriteOnly) {
      sql += ` AND c.favorite = 1`;
    }

    // Keyset pagination
    if (options.cursor) {
      const viewkeyOp = sortDir === "desc" ? ">" : "<";
      sql += ` AND (${sortCol} ${sortOp} ? OR (${sortCol} = ? AND v.viewkey ${viewkeyOp} ?))`;
      params.push(options.cursor.value, options.cursor.value, options.cursor.viewkey);
    }

    sql += ` ORDER BY ${sortCol} ${sortOrder}, v.viewkey ${viewkeyOrder} LIMIT ?`;
    params.push(limit + 1);
  }

  const rows = db.prepare(sql).all(...params) as VideoWithCuration[];

  const hasMore = rows.length > limit;
  const videos = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: Cursor = null;
  if (hasMore && videos.length > 0) {
    const last = videos[videos.length - 1];
    const cursorValue = sortBy === "duration" ? (last.duration || 0) : (last.views || 0);
    nextCursor = { value: cursorValue, viewkey: last.viewkey };
  }

  return { videos, nextCursor, hasMore };
}

/**
 * Get a single video by viewkey
 */
export function getVideoByViewkey(viewkey: string, source: DbSource = "embeds"): VideoWithCuration | undefined {
  const db = getDb(source);
  return db
    .prepare(
      `SELECT v.id, v.viewkey, v.title, v.primary_thumb, v.duration, v.views,
              v.embed_html, v.tags, v.categories, v.performers,
              COALESCE(c.status, 'pending') as status, c.note, COALESCE(c.favorite, 0) as favorite
       FROM videos v
       LEFT JOIN curation c ON c.viewkey = v.viewkey
       WHERE v.viewkey = ?`
    )
    .get(viewkey) as VideoWithCuration | undefined;
}

/**
 * Update curation status (approve/reject/maybe)
 */
export function updateCuration(
  viewkey: string,
  data: { status?: CurationStatus; note?: string; favorite?: boolean },
  source: DbSource = "embeds"
): void {
  const db = getDb(source);

  // Check if curation record exists
  const existing = db.prepare("SELECT 1 FROM curation WHERE viewkey = ?").get(viewkey);

  if (existing) {
    // Update existing
    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (data.status !== undefined) {
      updates.push("status = ?");
      params.push(data.status);
    }
    if (data.note !== undefined) {
      updates.push("note = ?");
      params.push(data.note);
    }
    if (data.favorite !== undefined) {
      updates.push("favorite = ?");
      params.push(data.favorite ? 1 : 0);
    }
    updates.push("updated_at = datetime('now')");

    params.push(viewkey);
    db.prepare(`UPDATE curation SET ${updates.join(", ")} WHERE viewkey = ?`).run(...params);
  } else {
    // Insert new
    db.prepare(
      `INSERT INTO curation (viewkey, status, note, favorite, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(
      viewkey,
      data.status || "pending",
      data.note || null,
      data.favorite ? 1 : 0
    );
  }
}

/**
 * Get stats
 */
export function getStats(source: DbSource = "embeds"): {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  favorites: number;
} {
  const db = getDb(source);
  const total = (db.prepare("SELECT COUNT(*) as cnt FROM videos").get() as { cnt: number }).cnt;
  const approved = (
    db.prepare("SELECT COUNT(*) as cnt FROM curation WHERE status = 'approved'").get() as { cnt: number }
  ).cnt;
  const rejected = (
    db.prepare("SELECT COUNT(*) as cnt FROM curation WHERE status = 'rejected'").get() as { cnt: number }
  ).cnt;
  const favorites = (
    db.prepare("SELECT COUNT(*) as cnt FROM curation WHERE favorite = 1").get() as { cnt: number }
  ).cnt;
  const pending = total - approved - rejected;

  return { total, approved, rejected, pending, favorites };
}

/**
 * Get unique categories from all videos
 */
export function getCategories(source: DbSource = "embeds"): string[] {
  const db = getDb(source);
  const rows = db
    .prepare("SELECT DISTINCT categories FROM videos WHERE categories IS NOT NULL")
    .all() as { categories: string }[];

  const allCats = new Set<string>();
  rows.forEach((r) => {
    if (r.categories) {
      r.categories.split(",").forEach((c) => {
        const trimmed = c.trim();
        if (trimmed) allCats.add(trimmed);
      });
    }
  });
  return Array.from(allCats).sort();
}

export type VideoWithSource = Omit<VideoWithCuration, "embed_html"> & {
  source: DbSource;
};

/**
 * Export approved videos for production
 */
export function getApprovedVideos(source: DbSource = "embeds"): VideoWithSource[] {
  const db = getDb(source);
  const rows = db
    .prepare(
      `SELECT v.id, v.viewkey, v.title, v.primary_thumb, v.duration, v.views,
              v.tags, v.categories, v.performers,
              c.status, c.note, c.favorite
       FROM videos v
       JOIN curation c ON c.viewkey = v.viewkey
       WHERE c.status = 'approved'
       ORDER BY c.favorite DESC, v.views DESC`
    )
    .all() as Omit<VideoWithCuration, "embed_html">[];

  // Add source field to each video
  return rows.map((row) => ({ ...row, source }));
}

/**
 * Export approved videos from all sources
 */
export function getAllApprovedVideos(): VideoWithSource[] {
  const embeds = getApprovedVideos("embeds");
  const xvidprem = getApprovedVideos("xvidprem");
  // Merge and sort by favorite then views
  return [...embeds, ...xvidprem].sort((a, b) => {
    if (a.favorite !== b.favorite) return b.favorite - a.favorite;
    return (b.views || 0) - (a.views || 0);
  });
}

/**
 * Delete all rejected videos from database
 */
export function deleteRejectedVideos(source: DbSource = "embeds"): number {
  const db = getDb(source);

  // Get viewkeys of rejected videos
  const rejected = db
    .prepare("SELECT viewkey FROM curation WHERE status = 'rejected'")
    .all() as { viewkey: string }[];

  if (rejected.length === 0) return 0;

  const viewkeys = rejected.map(r => r.viewkey);
  const placeholders = viewkeys.map(() => '?').join(',');

  // Delete from videos table
  db.prepare(`DELETE FROM videos WHERE viewkey IN (${placeholders})`).run(...viewkeys);

  // Delete from videos_fts table
  db.prepare(`DELETE FROM videos_fts WHERE rowid IN (SELECT id FROM videos WHERE viewkey IN (${placeholders}))`).run(...viewkeys);

  // Delete from curation table
  db.prepare(`DELETE FROM curation WHERE status = 'rejected'`).run();

  return rejected.length;
}
