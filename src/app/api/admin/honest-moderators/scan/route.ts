import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

/**
 * POST /api/admin/honest-moderators/scan
 * Scan for moderators who like 100% of a specific author's comments
 * If a mod liked every comment from a specific Diamond user, flag them
 */
export async function POST() {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (!access.isAdminOrMod) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN" },
      { status: 403 }
    );
  }

  // Heuristic threshold to avoid false positives on tiny samples
  const MIN_VOTES = 10;

  // Get all mod votes with comment author info
  const modVotes = await db.commentModVote.findMany({
    include: { comment: true },
  });

  // Group by modId + authorId
  const map = new Map<
    string,
    { modId: string; authorId: string; likes: number; total: number }
  >();

  for (const v of modVotes) {
    const key = `${v.modId}:${v.comment.authorId}`;
    const entry = map.get(key) ?? {
      modId: v.modId,
      authorId: v.comment.authorId,
      likes: 0,
      total: 0,
    };
    entry.total += 1;
    if (v.value === 1) entry.likes += 1;
    map.set(key, entry);
  }

  let created = 0;

  for (const entry of map.values()) {
    if (entry.total < MIN_VOTES) continue;

    // If like ratio is 100%
    if (entry.likes === entry.total) {
      // Check if flag already exists
      const existing = await db.moderatorIntegrityFlag.findFirst({
        where: {
          modId: entry.modId,
          authorId: entry.authorId,
          resolvedAt: null, // Not resolved yet
        },
      });

      if (!existing) {
        await db.moderatorIntegrityFlag.create({
          data: {
            modId: entry.modId,
            authorId: entry.authorId,
            reason: `Moderator liked 100% of this author's comments across ${entry.total} mod votes.`,
          },
        });
        created += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, created });
}

/**
 * GET /api/admin/honest-moderators/scan
 * Get all unresolved integrity flags
 */
export async function GET() {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (!access.isAdminOrMod) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const flags = await db.moderatorIntegrityFlag.findMany({
    where: { resolvedAt: null },
    include: {
      mod: { select: { walletAddress: true } },
      author: { select: { walletAddress: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, flags });
}
