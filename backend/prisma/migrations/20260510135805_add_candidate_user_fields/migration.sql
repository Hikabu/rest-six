-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "location" VARCHAR(255),
ADD COLUMN     "website" VARCHAR(255);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "isVerifiedPayer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalEscrowsFunded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalEscrowsReleased" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalJobsPosted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trustScore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "job_posts" ADD COLUMN     "escrowFundedAt" TIMESTAMP(3);
