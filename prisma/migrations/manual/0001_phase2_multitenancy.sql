-- Phase 2 delta: multi-tenancy + data-model integrity
-- Apply against an existing database previously created with `prisma db push`
-- of the pre-phase-2 schema. Review before running in production.
-- (0000_baseline.sql is the full schema for a fresh DB — do not run both.)

-- T2.2 — scope unique constraints to the org (drop global uniques, add composites)
DROP INDEX IF EXISTS "User_email_key";
-- "User_orgId_email_key" already exists from the prior @@unique([orgId, email]).

DROP INDEX IF EXISTS "Product_sku_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Product_orgId_sku_key" ON "Product"("orgId", "sku");

DROP INDEX IF EXISTS "Lead_externalId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_orgId_externalId_key" ON "Lead"("orgId", "externalId");

-- T2.6 — Outstanding: real foreign keys + default for daysOverdue
ALTER TABLE "Outstanding" ALTER COLUMN "daysOverdue" SET DEFAULT 0;
ALTER TABLE "Outstanding" DROP CONSTRAINT IF EXISTS "Outstanding_customerId_fkey";
ALTER TABLE "Outstanding"
  ADD CONSTRAINT "Outstanding_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Outstanding" DROP CONSTRAINT IF EXISTS "Outstanding_invoiceId_fkey";
ALTER TABLE "Outstanding"
  ADD CONSTRAINT "Outstanding_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- T2.5 — onDelete SET NULL on nullable user foreign keys (deactivation is the
-- policy for required FKs like AuditLog.userId / Lead.createdById, so those
-- are intentionally left as RESTRICT).
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_reportsToId_fkey";
ALTER TABLE "User"
  ADD CONSTRAINT "User_reportsToId_fkey"
  FOREIGN KEY ("reportsToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_assignedToId_fkey";
ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesOrder" DROP CONSTRAINT IF EXISTS "SalesOrder_assignedToId_fkey";
ALTER TABLE "SalesOrder"
  ADD CONSTRAINT "SalesOrder_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
