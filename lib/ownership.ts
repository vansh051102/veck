import { prisma } from './db'

// ============================================================================
// OWNERSHIP FILTERING
// ============================================================================

/**
 * Build a Prisma `where` clause that filters data based on the user's role,
 * department, and ownership. Used to scope queries to only the data the
 * user should see.
 *
 * Returns an object that can be spread into a Prisma `where` clause.
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
        return { assignedTo: { department: 'Marketing' } }
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
        return { assignedTo: { department: 'Sales' } }
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
      if (resource === 'leads') {
        return { stage: { in: ['Qualified', 'Quote Sent'] } }
      }
      if (resource === 'quotes' || resource === 'purchase_requests') {
        return { lead: { stage: { in: ['Qualified', 'Quote Sent'] } } }
      }
      return {}

    case 'sales_purchase':
      if (resource === 'leads') {
        return { OR: [{ assignedToId: userId }, { stage: { in: ['Qualified', 'Quote Sent'] } }] }
      }
      if (resource === 'activities') {
        return { lead: { assignedToId: userId } }
      }
      if (resource === 'quotes' || resource === 'purchase_requests') {
        return { OR: [{ lead: { assignedToId: userId } }, { lead: { stage: { in: ['Qualified', 'Quote Sent'] } } }] }
      }
      return {}

    default:
      return { id: '__DENY_ALL__' }
  }
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
      const assigneeDept = await prisma.user.findUnique({
        where: { id: lead.assignedToId ?? '' },
        select: { department: true },
      })
      return assigneeDept?.department === 'Marketing'
    }

    case 'marketing_executive':
      return lead.assignedToId === userId

    case 'sales_manager': {
      const assignee = await prisma.user.findUnique({
        where: { id: lead.assignedToId ?? '' },
        select: { department: true },
      })
      return assignee?.department === 'Sales'
    }

    case 'sales_executive':
      return lead.assignedToId === userId

    case 'purchase':
      return ['Qualified', 'Quote Sent'].includes(lead.stage)

    case 'sales_purchase':
      return lead.assignedToId === userId || ['Qualified', 'Quote Sent'].includes(lead.stage)

    default:
      return false
  }
}
