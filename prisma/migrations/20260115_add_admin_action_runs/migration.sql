-- CreateEnum
CREATE TYPE "AdminActionKey" AS ENUM (
  'RECOMPUTE_VIDEO_RANKS',
  'RECOMPUTE_REWARDS_EPOCH',
  'RECALCULATE_LEADERBOARDS',
  'REBUILD_SEARCH_INDEX',
  'FLUSH_CLOUDFLARE_CACHE',
  'RECOMPUTE_ANALYTICS'
);

-- CreateTable
CREATE TABLE "AdminActionRun" (
  "id" TEXT NOT NULL,
  "key" "AdminActionKey" NOT NULL,
  "lastRunAt" TIMESTAMP(3),
  "lastOk" BOOLEAN NOT NULL DEFAULT false,
  "lastMsg" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminActionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminActionRun_key_key" ON "AdminActionRun"("key");
