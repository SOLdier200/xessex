import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

/**
 * POST /api/admin/honest-moderators/scan
 * Scan for moderators who:
 * 1. Like 100% of a specific author's comments (more than 10 votes)
 * 2. Source-graded 100% of a specific author's comments (more than 10 grades)
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

  // Threshold: must have MORE than this number (so 11+ qualifies)
  const MIN_VOTES_THRESHOLD = 10;

  let created = 0;

  // ============ Check mod votes (100% likes) ============
  const modVotes = await db.commentModVote.findMany({
    include: { comment: true },
  });

  // Group by modId + authorId
  const voteMap = new Map<
    string,
    { modId: string; authorId: string; likes: number; total: number }
  >();

  for (const v of modVotes) {
    const key = `${v.modId}:${v.comment.authorId}`;
    const entry = voteMap.get(key) ?? {
      modId: v.modId,
      authorId: v.comment.authorId,
      likes: 0,
      total: 0,
    };
    entry.total += 1;
    if (v.value === 1) entry.likes += 1;
    voteMap.set(key, entry);
  }

  for (const entry of voteMap.values()) {
    // Must have MORE than threshold (> not >=)
    if (entry.total <= MIN_VOTES_THRESHOLD) continue;

    // If like ratio is 100%
    if (entry.likes === entry.total) {
      // Check if flag already exists
      const existing = await db.moderatorIntegrityFlag.findFirst({
        where: {
          modId: entry.modId,
          authorId: entry.authorId,
          reason: { startsWith: "Moderator liked 100%" },
          resolvedAt: null,
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

  // ============ Check source grades (100% graded) ============
  const sourceGrades = await db.commentSourceGrade.findMany({
    select: {
      modId: true,
      authorId: true,
    },
  });

  // Group by modId + authorId
  const gradeMap = new Map<
    string,
    { modId: string; authorId: string; count: number }
  >();

  for (const g of sourceGrades) {
    const key = `${g.modId}:${g.authorId}`;
    const entry = gradeMap.get(key) ?? {
      modId: g.modId,
      authorId: g.authorId,
      count: 0,
    };
    entry.count += 1;
    gradeMap.set(key, entry);
  }

  // For each mod+author pair with > threshold grades, check if they graded ALL of that author's comments
  for (const entry of gradeMap.values()) {
    if (entry.count <= MIN_VOTES_THRESHOLD) continue;

    // Count total comments by this author
    const totalAuthorComments = await db.comment.count({
      where: { authorId: entry.authorId },
    });

    // If mod graded 100% of author's comments
    if (entry.count === totalAuthorComments) {
      // Check if flag already exists
      const existing = await db.moderatorIntegrityFlag.findFirst({
        where: {
          modId: entry.modId,
          authorId: entry.authorId,
          reason: { startsWith: "Moderator source-graded 100%" },
          resolvedAt: null,
        },
      });

      if (!existing) {
        await db.moderatorIntegrityFlag.create({
          data: {
            modId: entry.modId,
            authorId: entry.authorId,
            reason: `Moderator source-graded 100% of this author's comments (${entry.count} total comments graded).`,
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
      mod: { select: { walletAddress: true, email: true } },
      author: { select: { walletAddress: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, flags });
}
