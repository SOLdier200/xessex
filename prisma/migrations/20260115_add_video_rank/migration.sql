-- Add rank column for deterministic global ordering
ALTER TABLE "Video" ADD COLUMN "rank" INTEGER;

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

CREATE UNIQUE INDEX "Video_rank_key" ON "Video"("rank");
CREATE INDEX "Video_rank_idx" ON "Video"("rank");
