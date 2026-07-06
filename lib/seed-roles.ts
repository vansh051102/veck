import { prisma } from './db'
import { ROLE_PERMISSIONS } from './rbac'

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
]

// ============================================================================
// SEEDING
// ============================================================================

/**
 * Seed default roles for an organization.
 * Safe to call multiple times — uses upsert so it won't create duplicates.
 * Call this on org creation or during migration.
 */
export async function seedDefaultRoles(orgId: string): Promise<void> {
  for (const role of DEFAULT_ROLES) {
    await prisma.role.upsert({
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
      update: {
        description: role.description,
        department: role.department,
        hierarchyLevel: role.hierarchyLevel,
        permissions: role.permissions,
      },
    })
  }

  console.log(`Seeded ${DEFAULT_ROLES.length} default roles for org ${orgId}`)
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
