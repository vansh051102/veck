-- SLA/KPI/KRA accountability engine: additive-only, scoped to this feature.
-- (Live DB has pre-existing drift vs schema.prisma from unrelated Phase 2 ERP
-- work — those tables/columns are intentionally left untouched here.)

-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "slaDefaultHours",
DROP COLUMN "slaWarningHours",
ADD COLUMN     "defaultCalendarId" TEXT;

-- CreateTable
CREATE TABLE "SlaClock" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "ruleId" TEXT,
    "stage" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" TIMESTAMP(3),
    "pausedMinutes" INTEGER NOT NULL DEFAULT 0,
    "endedAt" TIMESTAMP(3),
    "targetMinutes" INTEGER,
    "deadline" TIMESTAMP(3),
    "elapsedBusinessMinutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "warnedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "escalatedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaClock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "department" TEXT,
    "stage" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "targetMinutes" INTEGER,
    "warningPct" INTEGER NOT NULL DEFAULT 80,
    "calendarId" TEXT,
    "escalateToRoleId" TEXT,
    "notifyOnWarning" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnBreach" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "SlaRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessCalendar" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branch" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "workingHours" JSONB NOT NULL,
    "holidays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "halfDays" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiSnapshot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "bucketType" TEXT NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KraDefinition" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "department" TEXT,
    "roleId" TEXT,
    "metric" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "KraDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlaClock_orgId_entityType_entityId_idx" ON "SlaClock"("orgId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "SlaClock_orgId_status_idx" ON "SlaClock"("orgId", "status");

-- CreateIndex
CREATE INDEX "SlaClock_ruleId_idx" ON "SlaClock"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "SlaRule_orgId_entityType_department_stage_trigger_key" ON "SlaRule"("orgId", "entityType", "department", "stage", "trigger");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCalendar_orgId_branch_key" ON "BusinessCalendar"("orgId", "branch");

-- CreateIndex
CREATE INDEX "KpiSnapshot_orgId_metric_bucket_idx" ON "KpiSnapshot"("orgId", "metric", "bucket");

-- CreateIndex
CREATE UNIQUE INDEX "KpiSnapshot_orgId_scopeType_scopeId_metric_bucket_bucketTyp_key" ON "KpiSnapshot"("orgId", "scopeType", "scopeId", "metric", "bucket", "bucketType");

-- CreateIndex
CREATE INDEX "KraDefinition_orgId_department_idx" ON "KraDefinition"("orgId", "department");

-- AddForeignKey
ALTER TABLE "SlaClock" ADD CONSTRAINT "SlaClock_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaClock" ADD CONSTRAINT "SlaClock_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "SlaRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaRule" ADD CONSTRAINT "SlaRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaRule" ADD CONSTRAINT "SlaRule_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "BusinessCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCalendar" ADD CONSTRAINT "BusinessCalendar_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiSnapshot" ADD CONSTRAINT "KpiSnapshot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KraDefinition" ADD CONSTRAINT "KraDefinition_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
