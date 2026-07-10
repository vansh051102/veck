// ============================================================================
// AUTO-ASSIGNMENT ENGINE
// ============================================================================
// New leads are assigned automatically in two layers, applied only at creation:
//
//   1. AssignmentRule (workspace, admin-managed): the first active rule whose
//      source + weekday + productCategory match the new lead wins. This is the
//      primary mechanism (source/day-of-week routing) and runs independently of
//      the Settings toggle below.
//   2. Settings fallback (when Settings.autoAssignmentEnabled is on):
//        - "least_open_leads" (default): the active user with the fewest open
//          leads. Capacity-based; converges to even distribution.
//        - "round_robin": cycles through active users in alphabetical order,
//          picking the next after whoever received the most recent lead.
//
// Returns the userId to assign, or null to leave the lead unassigned.

import type { Prisma } from '@prisma/client'

// Context about the lead being created, used to match AssignmentRules.
export interface AssignContext {
  source?: string | null
  sourceDetails?: unknown
  // When the lead is created; drives the weekday match. Defaults to now.
  at?: Date
}

// Pulls a product/material category out of the lead's source details, if any
// (IndiaMART webhooks provide QUERY_MCAT_NAME / QUERY_PRODUCT_NAME).
function productCategoryFrom(sourceDetails: unknown): string | null {
  if (!sourceDetails || typeof sourceDetails !== 'object') return null
  const d = sourceDetails as Record<string, unknown>
  const cat = d.QUERY_MCAT_NAME ?? d.QUERY_PRODUCT_NAME ?? d.productCategory
  return typeof cat === 'string' && cat.trim() ? cat.trim() : null
}

// Finds the first active AssignmentRule matching the lead, honoring priority
// then creation order. A null weekday / productCategory on the rule means "any".
async function pickByRule(
  tx: Prisma.TransactionClient,
  orgId: string,
  ctx: AssignContext
): Promise<string | null> {
  if (!ctx.source) return null

  const weekday = (ctx.at ?? new Date()).getDay() // 0=Sunday .. 6=Saturday
  const category = productCategoryFrom(ctx.sourceDetails)

  const rules = await tx.assignmentRule.findMany({
    where: { orgId, isActive: true, source: ctx.source },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  })

  for (const rule of rules) {
    if (rule.weekday !== null && rule.weekday !== weekday) continue
    if (rule.productCategory !== null && rule.productCategory !== category) continue
    // Only route to a user who is still active.
    const assignee = await tx.user.findFirst({
      where: { id: rule.assignedToId, orgId, status: 'active' },
      select: { id: true },
    })
    if (assignee) return assignee.id
  }
  return null
}

export async function pickAssignee(
  tx: Prisma.TransactionClient,
  orgId: string,
  ctx: AssignContext = {}
): Promise<string | null> {
  // Layer 1: workspace assignment rules always take precedence.
  const byRule = await pickByRule(tx, orgId, ctx)
  if (byRule) return byRule

  // Layer 2: capacity/round-robin fallback, only when enabled in Settings.
  const settings = await tx.settings.findUnique({ where: { orgId } })
  if (!settings?.autoAssignmentEnabled) return null

  // Prefer Marketing assignees for new-lead intake; fall back to all active non-admin users
  let users = await tx.user.findMany({
    where: {
      orgId,
      status: 'active',
      department: 'Marketing',
      role: { not: 'admin' },
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  })
  if (users.length === 0) {
    users = await tx.user.findMany({
      where: { orgId, status: 'active', role: { not: 'admin' } },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    })
  }
  if (users.length === 0) return null

  const rule = (settings.autoAssignmentRule as { rule_type?: string } | null)?.rule_type

  if (rule === 'round_robin') {
    const lastLead = await tx.lead.findFirst({
      where: { orgId, assignedToId: { not: null } },
      orderBy: { assignedAt: 'desc' },
      select: { assignedToId: true },
    })
    const lastIndex = lastLead?.assignedToId
      ? users.findIndex((u) => u.id === lastLead.assignedToId)
      : -1
    return users[(lastIndex + 1) % users.length].id
  }

  // Default: least_open_leads
  const counts = await tx.lead.groupBy({
    by: ['assignedToId'],
    where: { orgId, status: 'open', assignedToId: { not: null } },
    _count: { _all: true },
  })
  const countByUser = new Map(counts.map((c) => [c.assignedToId as string, c._count._all]))

  let best: string | null = null
  let bestCount = Number.POSITIVE_INFINITY
  for (const user of users) {
    const count = countByUser.get(user.id) ?? 0
    if (count < bestCount) {
      best = user.id
      bestCount = count
    }
  }
  return best
}
