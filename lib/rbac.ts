import { prisma } from './db'
import { ForbiddenError } from './api-response'

// ============================================================================
// PERMISSION CONSTANTS
// ============================================================================

export const PERMISSIONS = {
  // Leads
  LEADS_CREATE: 'leads:create',
  LEADS_READ: 'leads:read',
  LEADS_EDIT: 'leads:edit',
  LEADS_DELETE: 'leads:delete',
  LEADS_ASSIGN: 'leads:assign',
  LEADS_EXPORT: 'leads:export',
  LEADS_IMPORT: 'leads:import',

  // Contacts
  CONTACTS_CREATE: 'contacts:create',
  CONTACTS_READ: 'contacts:read',
  CONTACTS_EDIT: 'contacts:edit',

  // Activities
  ACTIVITIES_CREATE: 'activities:create',
  ACTIVITIES_READ: 'activities:read',
  ACTIVITIES_EDIT: 'activities:edit',
  ACTIVITIES_DELETE: 'activities:delete',

  // Quotes
  QUOTES_CREATE: 'quotes:create',
  QUOTES_READ: 'quotes:read',
  QUOTES_EDIT: 'quotes:edit',
  QUOTES_SEND: 'quotes:send',

  // Purchase Requests
  PURCHASE_REQUESTS_CREATE: 'purchase_requests:create',
  PURCHASE_REQUESTS_READ: 'purchase_requests:read',
  PURCHASE_REQUESTS_EDIT: 'purchase_requests:edit',

  // Checklists
  CHECKLISTS_CREATE: 'checklists:create',
  CHECKLISTS_READ: 'checklists:read',
  CHECKLISTS_EDIT: 'checklists:edit',

  // Analytics
  ANALYTICS_READ: 'analytics:read',

  // Settings
  SETTINGS_READ: 'settings:read',
  SETTINGS_EDIT: 'settings:edit',

  // Users
  USERS_CREATE: 'users:create',
  USERS_READ: 'users:read',
  USERS_EDIT: 'users:edit',
  USERS_DELETE: 'users:delete',

  // Roles
  ROLES_CREATE: 'roles:create',
  ROLES_READ: 'roles:read',
  ROLES_EDIT: 'roles:edit',

  // Master Data
  MASTER_DATA_CREATE: 'master_data:create',
  MASTER_DATA_READ: 'master_data:read',
  MASTER_DATA_EDIT: 'master_data:edit',

  // Reports
  REPORTS_READ: 'reports:read',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// ============================================================================
// ROLE → PERMISSION MAPPING (DEFAULTS)
// ============================================================================

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'], // wildcard — all permissions

  marketing_manager: [
    PERMISSIONS.LEADS_CREATE,
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.LEADS_EDIT,
    PERMISSIONS.CONTACTS_CREATE,
    PERMISSIONS.CONTACTS_READ,
    PERMISSIONS.CONTACTS_EDIT,
    PERMISSIONS.ACTIVITIES_CREATE,
    PERMISSIONS.ACTIVITIES_READ,
    PERMISSIONS.ACTIVITIES_EDIT,
    PERMISSIONS.ACTIVITIES_DELETE,
    PERMISSIONS.ANALYTICS_READ,
  ],

  marketing_executive: [
    PERMISSIONS.LEADS_CREATE,
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.LEADS_EDIT,
    PERMISSIONS.CONTACTS_CREATE,
    PERMISSIONS.CONTACTS_READ,
    PERMISSIONS.CONTACTS_EDIT,
    PERMISSIONS.ACTIVITIES_CREATE,
    PERMISSIONS.ACTIVITIES_READ,
  ],

  sales_manager: [
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.LEADS_EDIT,
    PERMISSIONS.LEADS_ASSIGN,
    PERMISSIONS.CONTACTS_READ,
    PERMISSIONS.ACTIVITIES_CREATE,
    PERMISSIONS.ACTIVITIES_READ,
    PERMISSIONS.ACTIVITIES_EDIT,
    PERMISSIONS.ACTIVITIES_DELETE,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.ANALYTICS_READ,
  ],

  sales_executive: [
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.LEADS_EDIT,
    PERMISSIONS.CONTACTS_READ,
    PERMISSIONS.ACTIVITIES_CREATE,
    PERMISSIONS.ACTIVITIES_READ,
    PERMISSIONS.QUOTES_READ,
  ],

  purchase: [
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.QUOTES_CREATE,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.QUOTES_EDIT,
    PERMISSIONS.QUOTES_SEND,
    PERMISSIONS.PURCHASE_REQUESTS_CREATE,
    PERMISSIONS.PURCHASE_REQUESTS_READ,
    PERMISSIONS.PURCHASE_REQUESTS_EDIT,
    PERMISSIONS.CHECKLISTS_CREATE,
    PERMISSIONS.CHECKLISTS_READ,
    PERMISSIONS.CHECKLISTS_EDIT,
  ],
}

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

/**
 * Get the permissions array for a user by looking up their Role record.
 * Caches nothing — call sparingly or batch in middleware.
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return []

    // Admin role gets wildcard — short circuit
    if (user.role === 'admin') return ['*']

    const role = await prisma.role.findFirst({
      where: { orgId: user.orgId, name: user.role },
    })

    if (!role) return []

    return (role.permissions as string[]) || []
  } catch (error) {
    console.error('getUserPermissions error:', error)
    return []
  }
}

/**
 * Check if a user has a specific permission.
 * Returns true if the user has the permission or has wildcard '*'.
 */
export async function checkUserPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const permissions = await getUserPermissions(userId)

  // Wildcard check
  if (permissions.includes('*')) return true

  return permissions.includes(permission)
}

/**
 * Require a specific permission — throws ForbiddenError if missing.
 * Use this in API route handlers.
 */
export async function requirePermission(
  userId: string,
  permission: string
): Promise<void> {
  const hasPermission = await checkUserPermission(userId, permission)
  if (!hasPermission) {
    throw new ForbiddenError(`Missing required permission: ${permission}`)
  }
}

/**
 * Check if user has ANY of the given permissions.
 */
export async function checkAnyPermission(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId)

  if (userPermissions.includes('*')) return true

  return permissions.some((p) => userPermissions.includes(p))
}

/**
 * Require ANY of the given permissions — throws ForbiddenError if none match.
 */
export async function requireAnyPermission(
  userId: string,
  permissions: string[]
): Promise<void> {
  const hasAny = await checkAnyPermission(userId, permissions)
  if (!hasAny) {
    throw new ForbiddenError(
      `Missing required permissions: one of [${permissions.join(', ')}]`
    )
  }
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
 */
export function buildOwnershipFilter(
  userId: string,
  role: string,
  _department: string | null,
  resource: 'leads' | 'contacts' | 'activities' | 'quotes' | 'purchase_requests'
): Record<string, any> {
  switch (role) {
    case 'admin':
      // Admin sees everything in the org
      return {}

    case 'marketing_manager':
      // See all leads created by marketing department
      if (resource === 'leads') {
        return { createdBy: { department: 'Marketing' } }
      }
      if (resource === 'contacts') {
        return { createdById: { in: [] } } // Will be populated with marketing user IDs
      }
      return {}

    case 'marketing_executive':
      // See only leads they created
      if (resource === 'leads') {
        return { createdById: userId }
      }
      if (resource === 'contacts') {
        return { createdById: userId }
      }
      if (resource === 'activities') {
        return { createdBy: userId }
      }
      return {}

    case 'sales_manager':
      // See all leads assigned to sales department
      if (resource === 'leads') {
        return { assignedTo: { department: 'Sales' } }
      }
      return {}

    case 'sales_executive':
      // See only leads assigned to them
      if (resource === 'leads') {
        return { assignedToId: userId }
      }
      if (resource === 'activities') {
        return { lead: { assignedToId: userId } }
      }
      return {}

    case 'purchase':
      // See only leads in Qualified or Quote Sent stages
      if (resource === 'leads') {
        return { stage: { in: ['Qualified', 'Quote Sent'] } }
      }
      if (resource === 'quotes' || resource === 'purchase_requests') {
        return { lead: { stage: { in: ['Qualified', 'Quote Sent'] } } }
      }
      return {}

    default:
      // Unknown role — deny all
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
    case 'marketing_manager':
      // Can access any lead created by marketing
      const creator = await prisma.user.findUnique({
        where: { id: lead.createdById },
        select: { department: true },
      })
      return creator?.department === 'Marketing'

    case 'marketing_executive':
      return lead.createdById === userId

    case 'sales_manager':
      // Can access any lead assigned to sales
      const assignee = await prisma.user.findUnique({
        where: { id: lead.assignedToId ?? '' },
        select: { department: true },
      })
      return assignee?.department === 'Sales'

    case 'sales_executive':
      return lead.assignedToId === userId

    case 'purchase':
      return ['Qualified', 'Quote Sent'].includes(lead.stage)

    default:
      return false
  }
}
