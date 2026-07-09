-- Admin workspace: super-admin flag, company-details fields, module toggles,
-- and the Membership table (user <-> org many-to-many for workspace admin).
--
-- Super-admin bootstrap (deliberately NOT settable via any API — run manually
-- in psql / Supabase SQL editor):
--   UPDATE "User" SET "isSuperAdmin" = true WHERE "email" = 'you@example.com';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Organization"
  ADD COLUMN "industry" TEXT,
  ADD COLUMN "domain" TEXT,
  ADD COLUMN "companyEmail" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "gstin" TEXT,
  ADD COLUMN "pan" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "country" TEXT DEFAULT 'India',
  ADD COLUMN "moduleAccess" JSONB;

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one membership per existing user from their home org. Home-org
-- admins become workspace admins of their own company.
INSERT INTO "Membership" ("id", "userId", "orgId", "role", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u."id", u."orgId",
       CASE WHEN u."role" = 'admin' THEN 'admin' ELSE 'member' END,
       CASE WHEN u."status" = 'active' THEN 'active' ELSE 'revoked' END,
       NOW(), NOW()
FROM "User" u;
