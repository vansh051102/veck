import { prisma } from './db'

// ============================================================================
// DOCUMENT NUMBERING (QT-2026-001, PR-2026-001, ...)
// ============================================================================
// Numbers come from the OrgSequence counter table, incremented atomically
// with a single INSERT ... ON CONFLICT ... UPDATE ... RETURNING statement.
// Safe under concurrency: two racing requests are serialized by the row
// lock and always receive distinct values.

async function nextSequenceValue(orgId: string, key: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ value: number }[]>`
    INSERT INTO "OrgSequence" ("id", "orgId", "key", "value", "updatedAt")
    VALUES (gen_random_uuid(), ${orgId}, ${key}, 1, NOW())
    ON CONFLICT ("orgId", "key")
    DO UPDATE SET "value" = "OrgSequence"."value" + 1, "updatedAt" = NOW()
    RETURNING "value"
  `
  return rows[0].value
}

function formatDocNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(3, '0')}`
}

export async function nextQuoteNumber(
  orgId: string,
  year = new Date().getFullYear()
): Promise<string> {
  const seq = await nextSequenceValue(orgId, `QT-${year}`)
  return formatDocNumber('QT', year, seq)
}

export async function nextPurchaseRequestNumber(
  orgId: string,
  year = new Date().getFullYear()
): Promise<string> {
  const seq = await nextSequenceValue(orgId, `PR-${year}`)
  return formatDocNumber('PR', year, seq)
}
