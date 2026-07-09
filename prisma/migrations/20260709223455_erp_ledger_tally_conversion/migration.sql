-- DropIndex
DROP INDEX "StockMovement_productId_idx";

-- DropIndex
DROP INDEX "StockMovement_type_idx";

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "convertedCustomerId" TEXT,
ADD COLUMN     "convertedSalesOrderId" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" DROP COLUMN "type",
ADD COLUMN     "balanceAfter" INTEGER NOT NULL,
ADD COLUMN     "direction" TEXT NOT NULL,
ADD COLUMN     "inventoryId" TEXT NOT NULL,
ADD COLUMN     "reason" TEXT NOT NULL,
ADD COLUMN     "unitCost" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "TallySyncQueue" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'push',
    "format" TEXT NOT NULL DEFAULT 'xml',
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "tallyGuid" TEXT,
    "tallyMsgId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TallySyncQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TallySyncQueue_orgId_status_idx" ON "TallySyncQueue"("orgId", "status");

-- CreateIndex
CREATE INDEX "TallySyncQueue_status_createdAt_idx" ON "TallySyncQueue"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TallySyncQueue_orgId_entityType_entityId_direction_key" ON "TallySyncQueue"("orgId", "entityType", "entityId", "direction");

-- CreateIndex
CREATE INDEX "StockMovement_orgId_productId_createdAt_idx" ON "StockMovement"("orgId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_direction_idx" ON "StockMovement"("direction");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TallySyncQueue" ADD CONSTRAINT "TallySyncQueue_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

