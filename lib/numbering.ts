import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma } from './db'

// ============================================================================
// DOCUMENT NUMBERING (QT-2026-001, PR-2026-001, SO-2026-001, INV-2026-001, ...)
// ============================================================================
// Numbers come from the OrgSequence counter table, incremented atomically
// with a single INSERT ... ON CONFLICT ... UPDATE ... RETURNING statement.
// Safe under concurrency: two racing requests are serialized by the row
// lock and always receive distinct values.

// Accepts either the global client or a $transaction client. Inside a
// prisma.$transaction, pass `tx` so the counter increment commits/rolls back
// atomically with the document row — otherwise a rolled-back transaction still
// burns a sequence value.
type SeqClient = PrismaClient | Prisma.TransactionClient

async function nextSequenceValue(
  client: SeqClient,
  orgId: string,
  key: string
): Promise<number> {
  const rows = await client.$queryRaw<{ value: number }[]>`
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
  const seq = await nextSequenceValue(prisma, orgId, `QT-${year}`)
  return formatDocNumber('QT', year, seq)
}

export async function nextPurchaseRequestNumber(
  orgId: string,
  year = new Date().getFullYear()
): Promise<string> {
  const seq = await nextSequenceValue(prisma, orgId, `PR-${year}`)
  return formatDocNumber('PR', year, seq)
}

// ERP document numbers. `client` defaults to the global prisma but SHOULD be the
// $transaction client when called inside a conversion / order transaction.
export async function nextSalesOrderNumber(
  client: SeqClient,
  orgId: string,
  year = new Date().getFullYear()
): Promise<string> {
  const seq = await nextSequenceValue(client, orgId, `SO-${year}`)
  return formatDocNumber('SO', year, seq)
}

export async function nextInvoiceNumber(
  client: SeqClient,
  orgId: string,
  year = new Date().getFullYear()
): Promise<string> {
  const seq = await nextSequenceValue(client, orgId, `INV-${year}`)
  return formatDocNumber('INV', year, seq)
}
