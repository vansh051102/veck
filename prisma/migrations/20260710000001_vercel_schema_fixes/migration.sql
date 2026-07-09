-- Migration: vercel_schema_fixes
-- Makes prisma/schema.prisma match the current database by adding
-- columns, constraints, and tables that were added to the schema but
-- never migrated.
--
-- Safe to run on a live production database.

-- === 1. Timeline.orgId (with backfill from Lead) ===
ALTER TABLE "Timeline" ADD COLUMN "orgId" TEXT;

UPDATE "Timeline" SET "orgId" = (
  SELECT l."orgId" FROM "Lead" l WHERE l.id = "Timeline"."leadId"
);

ALTER TABLE "Timeline" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "Timeline"
  ADD CONSTRAINT "Timeline_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Timeline_orgId_idx" ON "Timeline"("orgId");

-- === 2. Timeline.contactId (optional) ===
ALTER TABLE "Timeline" ADD COLUMN "contactId" TEXT;

ALTER TABLE "Timeline"
  ADD CONSTRAINT "Timeline_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Timeline_contactId_idx" ON "Timeline"("contactId");

-- === 3. AssignmentRule orgId FK (column exists, constraint missing) ===
ALTER TABLE "AssignmentRule"
  ADD CONSTRAINT "AssignmentRule_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- === 4. Contact.companyId (column only — Customer table not yet created) ===
ALTER TABLE "Contact" ADD COLUMN "companyId" TEXT;

-- === 5. RateLimit table ===
CREATE TABLE IF NOT EXISTS "RateLimit" (
    "id"        TEXT NOT NULL,
    "orgId"     TEXT NOT NULL,
    "endpoint"  TEXT NOT NULL,
    "windowId"  BIGINT NOT NULL,
    "count"     INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RateLimit_orgId_endpoint_windowId_key"
  ON "RateLimit"("orgId", "endpoint", "windowId");

CREATE INDEX IF NOT EXISTS "RateLimit_orgId_endpoint_idx"
  ON "RateLimit"("orgId", "endpoint");

CREATE INDEX IF NOT EXISTS "RateLimit_updatedAt_idx"
  ON "RateLimit"("updatedAt");