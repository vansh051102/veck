-- Phase 3 delta: performance indexes + pipeline-velocity stamps
-- Apply after 0001. Safe to run on an existing database.

-- T3.3 — per-lead stage-entry timestamps (replace the audit-log scan in
-- /leads/stats). Backfill is optional; new transitions populate them going forward.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "qualifiedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "quoteSentAt" TIMESTAMP(3);

-- T3.5 — composite indexes matching the multi-tenant query patterns used by
-- the analytics / performance / stats routes.
CREATE INDEX IF NOT EXISTS "Lead_orgId_stage_idx" ON "Lead"("orgId", "stage");
CREATE INDEX IF NOT EXISTS "Lead_orgId_status_idx" ON "Lead"("orgId", "status");
CREATE INDEX IF NOT EXISTS "Lead_orgId_assignedToId_status_idx" ON "Lead"("orgId", "assignedToId", "status");

CREATE INDEX IF NOT EXISTS "Activity_orgId_idx" ON "Activity"("orgId");
CREATE INDEX IF NOT EXISTS "Activity_orgId_createdBy_createdAt_idx" ON "Activity"("orgId", "createdBy", "createdAt");
CREATE INDEX IF NOT EXISTS "Activity_orgId_type_createdAt_idx" ON "Activity"("orgId", "type", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_orgId_resourceType_action_timestamp_idx"
  ON "AuditLog"("orgId", "resourceType", "action", "timestamp");

-- Optional backfill from the audit log (run once if historical velocity matters):
-- UPDATE "Lead" l SET "qualifiedAt" = sub.ts FROM (
--   SELECT DISTINCT ON ("resourceId") "resourceId", "timestamp" AS ts FROM "AuditLog"
--   WHERE "resourceType"='Lead' AND "action"='STAGE_CHANGE' AND "changes"->>'toStage'='Qualified'
--   ORDER BY "resourceId", "timestamp" ASC
-- ) sub WHERE l.id = sub."resourceId" AND l."qualifiedAt" IS NULL;
-- (repeat with toStage='Quote Sent' → "quoteSentAt")
