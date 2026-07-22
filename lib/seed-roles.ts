import type { Prisma } from '@prisma/client'
import { prisma } from './db'
import { ROLE_PERMISSIONS } from './permissions'

// ============================================================================
// DEFAULT ROLE DEFINITIONS
// ============================================================================

interface RoleDefinition {
  name: string
  description: string
  department: string | null
  hierarchyLevel: number
  permissions: string[]
}

const DEFAULT_ROLES: RoleDefinition[] = [
  {
    name: 'admin',
    description: 'Full access to all modules and settings',
    department: null,
    hierarchyLevel: 2,
    permissions: ROLE_PERMISSIONS.admin,
  },
  {
    name: 'marketing_manager',
    description: 'Manage marketing team and all marketing leads',
    department: 'Marketing',
    hierarchyLevel: 1,
    permissions: ROLE_PERMISSIONS.marketing_manager,
  },
  {
    name: 'marketing_executive',
    description: 'Create and manage own leads, log activities',
    department: 'Marketing',
    hierarchyLevel: 0,
    permissions: ROLE_PERMISSIONS.marketing_executive,
  },
  {
    name: 'sales_manager',
    description: 'Manage sales team and all sales leads',
    department: 'Sales',
    hierarchyLevel: 1,
    permissions: ROLE_PERMISSIONS.sales_manager,
  },
  {
    name: 'sales_executive',
    description: 'Manage assigned leads, log activities, view quotes',
    department: 'Sales',
    hierarchyLevel: 0,
    permissions: ROLE_PERMISSIONS.sales_executive,
  },
  {
    name: 'purchase',
    description: 'Build quotations, manage vendor pricing, handle purchase requests',
    department: 'Purchase',
    hierarchyLevel: 0,
    permissions: ROLE_PERMISSIONS.purchase,
  },
  {
    name: 'sales_purchase',
    description: 'Dual role: manage own sales leads and build quotations/purchase requests',
    department: 'Sales',
    hierarchyLevel: 0,
    permissions: ROLE_PERMISSIONS.sales_purchase,
  },
]

// ============================================================================
// SEEDING
// ============================================================================

/**
 * Seed default roles for an organization.
 * Safe to call multiple times — uses upsert so it won't create duplicates.
 * Call this on org creation or during migration.
 *
 * Pass `db` when calling this from inside a $transaction — the org row is
 * only visible on that transaction's own connection until it commits, so
 * calling this with the global `prisma` client from inside another
 * transaction's callback fails with a foreign key constraint violation
 * (the org doesn't exist yet from that separate connection's point of view).
 */
export async function seedDefaultRoles(
  orgId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  for (const role of DEFAULT_ROLES) {
    await db.role.upsert({
      where: {
        orgId_name: { orgId, name: role.name },
      },
      create: {
        orgId,
        name: role.name,
        description: role.description,
        department: role.department,
        hierarchyLevel: role.hierarchyLevel,
        permissions: role.permissions,
      },
      // Do not overwrite permissions on existing roles — admins may have customized them
      update: {
        description: role.description,
        department: role.department,
        hierarchyLevel: role.hierarchyLevel,
      },
    })
  }
}

/**
 * Get a role definition by name.
 */
export function getRoleDefinition(name: string): RoleDefinition | undefined {
  return DEFAULT_ROLES.find((r) => r.name === name)
}

/**
 * Get all default role names.
 */
export function getDefaultRoleNames(): string[] {
  return DEFAULT_ROLES.map((r) => r.name)
}

/**
 * Check if a role name is a built-in default role.
 */
export function isDefaultRole(name: string): boolean {
  return DEFAULT_ROLES.some((r) => r.name === name)
}
