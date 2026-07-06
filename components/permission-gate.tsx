'use client'

import { useCurrentUser } from '@/lib/use-current-user'

interface PermissionGateProps {
  permission: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Renders children only if the current user has the specified permission.
 * Otherwise renders the fallback (or nothing).
 *
 * Usage:
 * <PermissionGate permission="leads:assign">
 *   <AssignButton lead={lead} />
 * </PermissionGate>
 */
export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const user = useCurrentUser()

  if (!user) return <>{fallback}</>
  if (user.permissions.includes('*')) return <>{children}</>
  if (user.permissions.includes(permission)) return <>{children}</>

  return <>{fallback}</>
}

interface AnyPermissionGateProps {
  permissions: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Renders children if the current user has ANY of the specified permissions.
 */
export function AnyPermissionGate({ permissions, children, fallback = null }: AnyPermissionGateProps) {
  const user = useCurrentUser()

  if (!user) return <>{fallback}</>
  if (user.permissions.includes('*')) return <>{children}</>
  if (permissions.some((p) => user.permissions.includes(p))) return <>{children}</>

  return <>{fallback}</>
}
