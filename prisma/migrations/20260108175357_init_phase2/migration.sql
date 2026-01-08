-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MOD', 'ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('MEMBER', 'DIAMOND');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELED', 'PENDING');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nowPaymentsPaymentId" TEXT,
    "nowPaymentsInvoiceId" TEXT,
    "lastTxSig" TEXT,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "embedUrl" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isShowcase" BOOLEAN NOT NULL DEFAULT false,
    "adminScore" INTEGER NOT NULL DEFAULT 50,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "avgStars" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "starsCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoStarRating" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoStarRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CommentStatus" NOT NULL DEFAULT 'ACTIVE',
    "removedById" TEXT,
    "removedAt" TIMESTAMP(3),
    "removedReason" TEXT,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentMemberVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "flipCount" INTEGER NOT NULL DEFAULT 0,
    "lastChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentMemberVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentModVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "flipCount" INTEGER NOT NULL DEFAULT 0,
    "lastChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentModVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoScoreAdjustment" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "direction" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoScoreAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeratorIntegrityFlag" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ModeratorIntegrityFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "windowStart" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteEvent" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "commentId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "action" TEXT NOT NULL,
    "vote" INTEGER,
    "prevVote" INTEGER,

    CONSTRAINT "VoteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_expiresAt_idx" ON "Subscription"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Video_slug_key" ON "Video"("slug");

-- CreateIndex
CREATE INDEX "Video_isShowcase_idx" ON "Video"("isShowcase");

-- CreateIndex
CREATE INDEX "VideoStarRating_userId_idx" ON "VideoStarRating"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoStarRating_videoId_userId_key" ON "VideoStarRating"("videoId", "userId");

-- CreateIndex
CREATE INDEX "Comment_videoId_idx" ON "Comment"("videoId");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "Comment_status_idx" ON "Comment"("status");

-- CreateIndex
CREATE INDEX "CommentMemberVote_voterId_idx" ON "CommentMemberVote"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentMemberVote_commentId_voterId_key" ON "CommentMemberVote"("commentId", "voterId");

-- CreateIndex
CREATE INDEX "CommentModVote_modId_idx" ON "CommentModVote"("modId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentModVote_commentId_modId_key" ON "CommentModVote"("commentId", "modId");

-- CreateIndex
CREATE INDEX "VideoScoreAdjustment_videoId_idx" ON "VideoScoreAdjustment"("videoId");

-- CreateIndex
CREATE INDEX "VideoScoreAdjustment_commentId_idx" ON "VideoScoreAdjustment"("commentId");

-- CreateIndex
CREATE INDEX "VideoScoreAdjustment_modId_idx" ON "VideoScoreAdjustment"("modId");

-- CreateIndex
CREATE INDEX "ModeratorIntegrityFlag_modId_idx" ON "ModeratorIntegrityFlag"("modId");

-- CreateIndex
CREATE INDEX "ModeratorIntegrityFlag_authorId_idx" ON "ModeratorIntegrityFlag"("authorId");

-- CreateIndex
CREATE INDEX "RateLimit_scope_key_windowStart_idx" ON "RateLimit"("scope", "key", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_scope_key_windowStart_key" ON "RateLimit"("scope", "key", "windowStart");

-- CreateIndex
CREATE INDEX "VoteEvent_ip_createdAt_idx" ON "VoteEvent"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "VoteEvent_userId_createdAt_idx" ON "VoteEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoStarRating" ADD CONSTRAINT "VideoStarRating_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoStarRating" ADD CONSTRAINT "VideoStarRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentMemberVote" ADD CONSTRAINT "CommentMemberVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentMemberVote" ADD CONSTRAINT "CommentMemberVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentModVote" ADD CONSTRAINT "CommentModVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentModVote" ADD CONSTRAINT "CommentModVote_modId_fkey" FOREIGN KEY ("modId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoScoreAdjustment" ADD CONSTRAINT "VideoScoreAdjustment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoScoreAdjustment" ADD CONSTRAINT "VideoScoreAdjustment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoScoreAdjustment" ADD CONSTRAINT "VideoScoreAdjustment_modId_fkey" FOREIGN KEY ("modId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratorIntegrityFlag" ADD CONSTRAINT "ModeratorIntegrityFlag_modId_fkey" FOREIGN KEY ("modId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratorIntegrityFlag" ADD CONSTRAINT "ModeratorIntegrityFlag_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
