import type { Prisma } from '@prisma/client'

// ============================================================================
// TALLYPRIME SYNC (mandate #5)
// ============================================================================
// enqueue() records intent to push an entity to Tally; a separate worker (not in
// this slice) drains the queue and calls renderPayload() to build the envelope.

export interface EnqueueInput {
  orgId: string
  entityType: string // invoice | sales_order | ledger | payment
  entityId: string
  format?: 'xml' | 'json'
  createdBy?: string | null
}

// Idempotent: the (orgId, entityType, entityId, direction) unique key means a
// re-enqueue upserts the existing row (resetting a prior failure to pending)
// rather than creating a duplicate.
export async function enqueue(tx: Prisma.TransactionClient, input: EnqueueInput) {
  const { orgId, entityType, entityId, format = 'xml', createdBy = null } = input
  return tx.tallySyncQueue.upsert({
    where: {
      orgId_entityType_entityId_direction: {
        orgId,
        entityType,
        entityId,
        direction: 'push',
      },
    },
    create: { orgId, entityType, entityId, format, createdBy },
    update: { status: 'pending', lastError: null },
  })
}

// ---------------------------------------------------------------------------
// Payload blueprint — structural TallyPrime import envelope in JSON or XML.
// Real field mapping (GST ledgers, stock items, party masters) expands per
// voucher type; this proves the JSON↔XML shape the worker will push.
// ponytail: skeleton now, fill fields when the connector is actually built.
// ---------------------------------------------------------------------------

export interface TallyEnvelope {
  ENVELOPE: {
    HEADER: { TALLYREQUEST: string }
    BODY: {
      IMPORTDATA: {
        REQUESTDESC: { REPORTNAME: string }
        REQUESTDATA: { TALLYMESSAGE: Record<string, unknown> }
      }
    }
  }
}

const VOUCHER_TYPE: Record<string, string> = {
  sales_order: 'Sales Order',
  invoice: 'Sales',
  payment: 'Receipt',
  ledger: 'Ledger',
}

export function buildTallyEnvelope(
  entityType: string,
  entity: Record<string, any>
): TallyEnvelope {
  const voucherType = VOUCHER_TYPE[entityType] ?? entityType
  return {
    ENVELOPE: {
      HEADER: { TALLYREQUEST: 'Import Data' },
      BODY: {
        IMPORTDATA: {
          REQUESTDESC: { REPORTNAME: 'Vouchers' },
          REQUESTDATA: {
            TALLYMESSAGE: {
              VOUCHER: {
                '@_VCHTYPE': voucherType,
                DATE: entity.date ?? entity.invoiceDate ?? entity.createdAt ?? null,
                VOUCHERNUMBER:
                  entity.number ?? entity.invoiceNumber ?? entity.soNumber ?? entity.id,
                PARTYLEDGERNAME: entity.partyName ?? entity.customerName ?? null,
                AMOUNT: entity.totalAmount ?? entity.amount ?? null,
              },
            },
          },
        },
      },
    },
  }
}

export function renderPayload(
  entityType: string,
  entity: Record<string, any>,
  format: 'xml' | 'json' = 'xml'
): string {
  const envelope = buildTallyEnvelope(entityType, entity)
  return format === 'json' ? JSON.stringify(envelope) : toXml(envelope)
}

// Minimal, dependency-free object→XML for the Tally envelope. Keys prefixed with
// '@_' become attributes; everything else nests. ponytail: enough for the
// structural blueprint; swap for a hardened XML builder if Tally rejects edge
// cases beyond basic entity escaping.
function toXml(node: unknown, tag?: string): string {
  if (node === null || node === undefined) return tag ? `<${tag}/>` : ''
  if (typeof node !== 'object') {
    const text = escapeXml(String(node))
    return tag ? `<${tag}>${text}</${tag}>` : text
  }
  const entries = Object.entries(node as Record<string, unknown>)
  const attrs = entries
    .filter(([k]) => k.startsWith('@_'))
    .map(([k, v]) => ` ${k.slice(2)}="${escapeXml(String(v))}"`)
    .join('')
  const children = entries
    .filter(([k]) => !k.startsWith('@_'))
    .map(([k, v]) => toXml(v, k))
    .join('')
  if (!tag) return children
  return `<${tag}${attrs}>${children}</${tag}>`
}

const XML_ESCAPES: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;',
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => XML_ESCAPES[c])
}
