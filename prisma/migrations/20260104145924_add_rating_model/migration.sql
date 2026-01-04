-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "viewkey" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Rating_viewkey_idx" ON "Rating"("viewkey");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_userId_viewkey_key" ON "Rating"("userId", "viewkey");
