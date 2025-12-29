import Database from "better-sqlite3";
import path from "path";

// Use DB_PATH env var if set, otherwise fallback to local path for dev
const dbPath = process.env.DB_PATH || path.join(process.cwd(), "embeds.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath, { readonly: false });
    db.pragma("journal_mode = WAL");
  }
  return db;
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

// Keyset pagination cursor
export type Cursor = {
  views: number;
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
  favoriteOnly?: boolean;
  cursor?: Cursor;
  limit?: number;
}): VideoListResult {
  const db = getDb();
  const limit = options.limit || 50;
  const params: (string | number)[] = [];

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

    // Favorite filter
    if (options.favoriteOnly) {
      sql += ` AND c.favorite = 1`;
    }

    // Keyset pagination
    if (options.cursor) {
      sql += ` AND (v.views < ? OR (v.views = ? AND v.viewkey > ?))`;
      params.push(options.cursor.views, options.cursor.views, options.cursor.viewkey);
    }

    sql += ` ORDER BY v.views DESC, v.viewkey ASC LIMIT ?`;
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

    // Favorite filter
    if (options.favoriteOnly) {
      sql += ` AND c.favorite = 1`;
    }

    // Keyset pagination
    if (options.cursor) {
      sql += ` AND (v.views < ? OR (v.views = ? AND v.viewkey > ?))`;
      params.push(options.cursor.views, options.cursor.views, options.cursor.viewkey);
    }

    sql += ` ORDER BY v.views DESC, v.viewkey ASC LIMIT ?`;
    params.push(limit + 1);
  }

  const rows = db.prepare(sql).all(...params) as VideoWithCuration[];

  const hasMore = rows.length > limit;
  const videos = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: Cursor = null;
  if (hasMore && videos.length > 0) {
    const last = videos[videos.length - 1];
    nextCursor = { views: last.views || 0, viewkey: last.viewkey };
  }

  return { videos, nextCursor, hasMore };
}

/**
 * Get a single video by viewkey
 */
export function getVideoByViewkey(viewkey: string): VideoWithCuration | undefined {
  const db = getDb();
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
  data: { status?: CurationStatus; note?: string; favorite?: boolean }
): void {
  const db = getDb();

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
export function getStats(): {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  favorites: number;
} {
  const db = getDb();
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
export function getCategories(): string[] {
  const db = getDb();
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

/**
 * Export approved videos for production
 */
export function getApprovedVideos(): Omit<VideoWithCuration, "embed_html">[] {
  const db = getDb();
  return db
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
}
