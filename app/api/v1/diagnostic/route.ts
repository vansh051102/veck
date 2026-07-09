import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/db'

const SQL = `
ALTER TABLE "Timeline" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
UPDATE "Timeline" SET "orgId" = (SELECT l."orgId" FROM "Lead" l WHERE l.id = "Timeline"."leadId") WHERE "orgId" IS NULL;
ALTER TABLE "Timeline" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Timeline" ADD CONSTRAINT IF NOT EXISTS "Timeline_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Timeline_orgId_idx" ON "Timeline"("orgId");
ALTER TABLE "Timeline" ADD COLUMN IF NOT EXISTS "contactId" TEXT;
ALTER TABLE "Timeline" ADD CONSTRAINT IF NOT EXISTS "Timeline_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Timeline_contactId_idx" ON "Timeline"("contactId");
ALTER TABLE "AssignmentRule" ADD CONSTRAINT IF NOT EXISTS "AssignmentRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
CREATE TABLE IF NOT EXISTS "RateLimit" ("id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "endpoint" TEXT NOT NULL, "windowId" BIGINT NOT NULL, "count" INTEGER NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "RateLimit_orgId_endpoint_windowId_key" ON "RateLimit"("orgId", "endpoint", "windowId");
CREATE INDEX IF NOT EXISTS "RateLimit_orgId_endpoint_idx" ON "RateLimit"("orgId", "endpoint");
CREATE INDEX IF NOT EXISTS "RateLimit_updatedAt_idx" ON "RateLimit"("updatedAt");
`

export const GET = async () => {
  const vars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'UNDEFINED',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'UNDEFINED',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'UNDEFINED',
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'UNDEFINED',
  }

  const checks: Record<string, string> = {}

  try {
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    checks.supabaseClient = 'OK'
  } catch (e: any) {
    checks.supabaseClient = `ERROR: ${e.message}`
  }

  try {
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    checks.supabaseAdmin = 'OK'
  } catch (e: any) {
    checks.supabaseAdmin = `ERROR: ${e.message}`
  }

  try {
    const orgCount = await prisma.organization.count()
    checks.prisma = `CONNECTED (${orgCount} orgs)`
  } catch (e: any) {
    checks.prisma = `ERROR: ${e.message?.substring(0, 200)}`
  }

  try {
    await prisma.$executeRawUnsafe(SQL)
    checks.migrationApplied = 'YES'
  } catch (e: any) {
    checks.migrationApplied = `ERROR: ${e.message?.substring(0, 200)}`
  }

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: `diag-${Date.now()}@test.com`,
      password: 'password123',
    })
    if (error) {
      checks.adminCreateUser = `SUPABASE_ERROR: ${error.message}`
    } else if (data?.user) {
      checks.adminCreateUser = `OK (user: ${data.user.id})`
    } else {
      checks.adminCreateUser = 'UNKNOWN: no user and no error'
    }
  } catch (e: any) {
    checks.adminCreateUser = `THROW: ${e.message?.substring(0, 200)}`
  }

  try {
    const org = await prisma.organization.create({
      data: {
        name: 'Diag Org',
        slug: `diag-${Date.now()}`,
        subscriptionPlan: 'free',
      },
    })
    checks.createOrg = `OK (org: ${org.id})`
  } catch (e: any) {
    checks.createOrg = `ERROR: ${e.message?.substring(0, 200)}`
  }

  return NextResponse.json({ env: vars, checks })
}