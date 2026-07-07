'use client'

// ============================================================================
// BACKWARD-COMPATIBLE RE-EXPORTS
// ============================================================================
// This file re-exports everything from the new AuthProvider-based
// implementation. All existing imports like:
//   import { useCurrentUser } from '@/lib/use-current-user'
// continue to work. The global mutable cache has been eliminated.
//
// New code should import from '@/lib/providers/auth-provider' directly.

export { AuthProvider, useAuth } from './providers/auth-provider'
export { useCurrentUser, useHasPermission, useHasAnyPermission } from './providers/auth-provider'

// Type re-exports
export interface CurrentUser {
  id: string
  email: string
  fullName: string
  role: string
  department: string | null
  designation: string | null
  permissions: string[]
}

export interface MeResponse {
  user: CurrentUser
  org: { id: string; name: string }
}

/**
 * @deprecated Use useAuth().invalidate() instead.
 * This function is kept for backward compatibility only.
 */
export function invalidateCurrentUser(): void {
  // In the new provider, invalidation happens via useAuth().invalidate()
  // or automatically on auth state changes. This is a no-op for code
  // that still calls the old function.
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
}
