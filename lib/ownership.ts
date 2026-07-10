import { prisma } from './db'

/** Stages purchase can see for quote handoff + post-order procurement. */
const PURCHASE_VISIBLE_STAGES = [
  'Qualified',
  'Quote Sent',
  'Order Confirmed',
  'Order Closed',
  'Closed Won', // legacy
] as const

/**
 * Sales user IDs that report (directly or indirectly) to `managerId`,
 * plus `managerId` itself. Used so purchase can see leads owned by their
 * designated salespeople (reportsTo hierarchy).
 */
export async function getDescendantUserIds(managerId: string): Promise<string[]> {
  const ids = new Set<string>([managerId])
  let frontier = [managerId]

  // Walk reportsTo tree breadth-first (orgs are small; cap depth for safety)
  for (let depth = 0; depth < 8 && frontier.length > 0; depth++) {
    const reports = await prisma.user.findMany({
      where: { reportsToId: { in: frontier }, status: 'active' },
      select: { id: true },
    })
    frontier = []
    for (const r of reports) {
      if (!ids.has(r.id)) {
        ids.add(r.id)
        frontier.push(r.id)
      }
    }
  }

  return [...ids]
}

/**
 * For a purchase user: IDs of salespeople they should see.
 * Prefer users who report to this purchase user; if none, fall back to
 * the purchase user's own assigned leads only (self).
 */
export async function getPurchaseSalesScope(purchaseUserId: string): Promise<string[]> {
  const reports = await prisma.user.findMany({
    where: {
      reportsToId: purchaseUserId,
      status: 'active',
      OR: [
        { department: 'Sales' },
        { role: { in: ['sales_executive', 'sales_manager', 'sales_purchase'] } },
      ],
    },
    select: { id: true },
  })

  if (reports.length > 0) {
    const nested: string[] = []
    for (const r of reports) {
      nested.push(...(await getDescendantUserIds(r.id)))
    }
    return [...new Set(nested)]
  }

  // No designated sales reps — only leads explicitly assigned to purchase
  return [purchaseUserId]
}

// ============================================================================
// OWNERSHIP FILTERING
// ============================================================================

/**
 * Build a Prisma `where` clause that filters data based on the user's role,
 * department, and ownership. Used to scope queries to only the data the
 * user should see.
 *
 * Returns an object that can be spread into a Prisma `where` clause.
 *
 * Note: `purchase` filter is async-resolved via `buildOwnershipFilterAsync`
 * when reportsTo scope is needed. Sync version uses assigned-to-self only;
 * list routes should prefer the async helper.
 */
export function buildOwnershipFilter(
  userId: string,
  role: string,
  _department: string | null,
  resource: 'leads' | 'contacts' | 'activities' | 'quotes' | 'purchase_requests'
): Record<string, any> {
  switch (role) {
    case 'admin':
      return {}

    case 'marketing_manager':
      if (resource === 'leads') {
        return {
          OR: [{ assignedToId: null }, { assignedTo: { department: 'Marketing' } }],
        }
      }
      return {}

    case 'marketing_executive':
      if (resource === 'leads') {
        return { assignedToId: userId }
      }
      if (resource === 'activities') {
        return { lead: { assignedToId: userId } }
      }
      return {}

    case 'sales_manager':
      if (resource === 'leads') {
        return {
          OR: [{ assignedToId: null }, { assignedTo: { department: 'Sales' } }],
        }
      }
      return {}

    case 'sales_executive':
      if (resource === 'leads') {
        return { assignedToId: userId }
      }
      if (resource === 'activities') {
        return { lead: { assignedToId: userId } }
      }
      return {}

    case 'purchase':
      // Sync fallback: own assignments in purchase-visible stages.
      // Prefer buildOwnershipFilterAsync for designated-sales scope.
      if (resource === 'leads') {
        return {
          assignedToId: userId,
          stage: { in: [...PURCHASE_VISIBLE_STAGES] },
        }
      }
      if (resource === 'quotes' || resource === 'purchase_requests') {
        return {
          lead: {
            assignedToId: userId,
            stage: { in: [...PURCHASE_VISIBLE_STAGES] },
          },
        }
      }
      return {}

    case 'sales_purchase':
      if (resource === 'leads') {
        return { assignedToId: userId }
      }
      if (resource === 'activities') {
        return { lead: { assignedToId: userId } }
      }
      if (resource === 'quotes' || resource === 'purchase_requests') {
        return { lead: { assignedToId: userId } }
      }
      return {}

    default:
      return { id: '__DENY_ALL__' }
  }
}

/**
 * Async ownership filter — expands purchase visibility to designated sales reps
 * (users with reportsToId = purchase user).
 */
export async function buildOwnershipFilterAsync(
  userId: string,
  role: string,
  department: string | null,
  resource: 'leads' | 'contacts' | 'activities' | 'quotes' | 'purchase_requests'
): Promise<Record<string, any>> {
  if (role !== 'purchase') {
    return buildOwnershipFilter(userId, role, department, resource)
  }

  const salesScope = await getPurchaseSalesScope(userId)
  const stageFilter = { in: [...PURCHASE_VISIBLE_STAGES] }

  if (resource === 'leads') {
    return {
      stage: stageFilter,
      OR: [
        { assignedToId: { in: salesScope } },
        { assignedToId: userId },
      ],
    }
  }
  if (resource === 'quotes' || resource === 'purchase_requests') {
    return {
      lead: {
        stage: stageFilter,
        OR: [
          { assignedToId: { in: salesScope } },
          { assignedToId: userId },
        ],
      },
    }
  }
  if (resource === 'activities') {
    return {
      lead: {
        stage: stageFilter,
        OR: [
          { assignedToId: { in: salesScope } },
          { assignedToId: userId },
        ],
      },
    }
  }
  return {}
}

/**
 * Check if a user can access a specific lead (for detail views and edits).
 * Returns true if the user has access based on their role and ownership.
 */
export async function canAccessLead(
  userId: string,
  role: string,
  leadId: string
): Promise<boolean> {
  if (role === 'admin') return true

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { createdById: true, assignedToId: true, stage: true },
  })

  if (!lead) return false

  switch (role) {
    case 'marketing_manager': {
      if (!lead.assignedToId) return true
      const assigneeDept = await prisma.user.findUnique({
        where: { id: lead.assignedToId },
        select: { department: true },
      })
      return assigneeDept?.department === 'Marketing'
    }

    case 'marketing_executive':
      return lead.assignedToId === userId

    case 'sales_manager': {
      if (!lead.assignedToId) return true
      const assignee = await prisma.user.findUnique({
        where: { id: lead.assignedToId },
        select: { department: true },
      })
      return assignee?.department === 'Sales'
    }

    case 'sales_executive':
      return lead.assignedToId === userId

    case 'purchase': {
      if (!PURCHASE_VISIBLE_STAGES.includes(lead.stage as (typeof PURCHASE_VISIBLE_STAGES)[number])) {
        return false
      }
      if (lead.assignedToId === userId) return true
      if (!lead.assignedToId) return false
      const salesScope = await getPurchaseSalesScope(userId)
      return salesScope.includes(lead.assignedToId)
    }

    case 'sales_purchase':
      return lead.assignedToId === userId

    default:
      return false
  }
}
