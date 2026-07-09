-- CreateTable
CREATE TABLE "bid_suggestions" (
    "id" TEXT NOT NULL,
    "freelanceJobId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "suggestedAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_suggestions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bid_suggestions" ADD CONSTRAINT "bid_suggestions_freelanceJobId_fkey" FOREIGN KEY ("freelanceJobId") REFERENCES "freelance_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_suggestions" ADD CONSTRAINT "bid_suggestions_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
