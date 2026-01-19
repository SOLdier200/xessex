import { db } from "@/lib/prisma";

type RankDb = {
  $executeRawUnsafe: (query: string) => Promise<number>;
};

/**
 * Recomputes Video.rank deterministically without violating UNIQUE(rank).
 *
 * If rank has a unique constraint, a single UPDATE can collide mid-update.
 * Strategy:
 *  1) Shift all existing ranks by a big offset to free the 1..N space
 *  2) Assign fresh ranks from a window function
 */
export async function recomputeVideoRanks(tx: RankDb = db) {
  const OFFSET = 1000000;

  // Phase 1: move current ranks out of the way (avoids collisions)
  await tx.$executeRawUnsafe(`
    UPDATE "Video"
    SET "rank" = "rank" + ${OFFSET}
    WHERE "rank" IS NOT NULL;
  `);

  // Phase 2: compute and assign final ranks
  await tx.$executeRawUnsafe(`
    WITH ordered AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          ORDER BY
            "avgStars" DESC,
            "adminScore" DESC,
            "starsCount" DESC,
            "createdAt" DESC,
            id ASC
        ) AS new_rank
      FROM "Video"
    )
    UPDATE "Video" v
    SET "rank" = o.new_rank
    FROM ordered o
    WHERE v.id = o.id;
  `);
}
