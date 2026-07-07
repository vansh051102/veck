// ============================================================================
// RBAC SERVICE
// ============================================================================
// Single source of truth for permission checking. Replaces the duplicate logic
// in lib/auth.ts and the scattered permission checks across API routes.
//
// Usage:
//   const perms = await rbacService.getUserPermissions(userId)
//   rbacService.requirePermission(perms, 'leads:create')

import { prisma } from '@/lib/db'

export interface UserPermissions {
  permissions: string[]
  hasWildcard: boolean
}

export class PermissionDeniedError extends Error {
  constructor(public readonly permission: string) {
    super(`Missing required permission: ${permission}`)
    this.name = 'PermissionDeniedError'
  }
}

export class PermissionResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermissionResolutionError'
  }
}

export class RbacService {
  /**
   * Get the permissions for a user by looking up their Role record.
   * Returns a cached result for the duration of the request (in-memory Map).
   */
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, orgId: true },
      })

      if (!user) {
        throw new PermissionResolutionError(`User ${userId} not found`)
      }

      // Admin role gets wildcard — short circuit
      if (user.role === 'admin') {
        return { permissions: ['*'], hasWildcard: true }
      }

      const role = await prisma.role.findFirst({
        where: { orgId: user.orgId, name: user.role },
      })

      if (!role) {
        // Role not found in DB — return empty permissions (deny all)
        return { permissions: [], hasWildcard: false }
      }

      const permissions = (role.permissions as string[]) || []
      return {
        permissions,
        hasWildcard: permissions.includes('*'),
      }
    } catch (error) {
      if (error instanceof PermissionResolutionError) throw error
      console.error('getUserPermissions error:', error)
      // On DB error, deny all permissions (fail closed)
      return { permissions: [], hasWildcard: false }
    }
  }

  /**
   * Check if a user has a specific permission.
   */
  checkPermission(perms: UserPermissions, permission: string): boolean {
    return perms.hasWildcard || perms.permissions.includes(permission)
  }

  /**
   * Require a specific permission — throws PermissionDeniedError if missing.
   * Use this in API route handlers.
   */
  requirePermission(perms: UserPermissions, permission: string): void {
    if (!this.checkPermission(perms, permission)) {
      throw new PermissionDeniedError(permission)
    }
  }

  /**
   * Check if user has ANY of the given permissions.
   */
  checkAnyPermission(perms: UserPermissions, permissions: string[]): boolean {
    return perms.hasWildcard || permissions.some((p) => perms.permissions.includes(p))
  }

  /**
   * Require ANY of the given permissions — throws PermissionDeniedError if none match.
   */
  requireAnyPermission(perms: UserPermissions, permissions: string[]): void {
    if (!this.checkAnyPermission(perms, permissions)) {
      throw new PermissionDeniedError(`one of [${permissions.join(', ')}]`)
    }
  }
}

// Singleton instance
export const rbacService = new RbacService()
