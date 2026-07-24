-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "closingHorizon" TEXT,
ADD COLUMN     "dealWonDetails" TEXT,
ADD COLUMN     "dealWonReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "orderValue" DECIMAL(12,2),
ADD COLUMN     "pinCode" TEXT,
ADD COLUMN     "serviceArea" TEXT,
ADD COLUMN     "targetClosingDate" TIMESTAMP(3),
ADD COLUMN     "territory" TEXT,
ADD COLUMN     "totalCalls" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalMessages" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "maskedFields" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "maskedFieldsOverride" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Contact_deletedAt_idx" ON "Contact"("deletedAt");

-- CreateIndex
CREATE INDEX "Lead_deletedAt_idx" ON "Lead"("deletedAt");

-- CreateIndex
CREATE INDEX "Quote_deletedAt_idx" ON "Quote"("deletedAt");
