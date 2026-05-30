-- CreateTable
CREATE TABLE "RankSnapshot" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RankSnapshot_takenAt_idx" ON "RankSnapshot"("takenAt");

-- CreateIndex
CREATE INDEX "RankSnapshot_playerId_idx" ON "RankSnapshot"("playerId");
