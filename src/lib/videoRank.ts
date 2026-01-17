import { db } from "@/lib/prisma";

type RankDb = {
  $executeRawUnsafe: (query: string) => Promise<number>;
};

export async function recomputeVideoRanks(tx: RankDb = db) {
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
