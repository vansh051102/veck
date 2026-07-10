'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { api } from '@/lib/api-client'
import { CurrentUser, MeResponse } from '@/lib/use-current-user'

interface AuthContextValue {
  user: CurrentUser | null
  org: { id: string; name: string } | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  invalidate: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * AuthProvider — replaces the global mutable cache in use-current-user.ts.
 *
 * Provides:
 * - User data from /auth/me (DB-verified, not header-trusted)
 * - Automatic re-fetch on auth state changes (sign in/out)
 * - No global mutable state (React-managed, SSR-safe)
 * - Clean error boundaries
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [org, setOrg] = useState<{ id: string; name: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUser = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await api.get<MeResponse>('/auth/me')
      setUser(res.data?.user ?? null)
      setOrg(res.data?.org ?? null)
    } catch (err) {
      setUser(null)
      setOrg(null)
      setError(err instanceof Error ? err.message : 'Failed to load user')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const invalidate = useCallback(() => {
    setUser(null)
    setOrg(null)
  }, [])

  useEffect(() => {
    // Initial fetch
    fetchUser()

    // Subscribe to auth state changes
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
          fetchUser()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchUser])

  return (
    <AuthContext.Provider value={{ user, org, isLoading, error, refetch: fetchUser, invalidate }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to get the current user from AuthProvider context.
 * Must be used within <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>')
  }
  return ctx
}

/**
 * Hook to get the current user (backward-compatible with useCurrentUser).
 * Returns null if not authenticated or still loading.
 */
export function useCurrentUser(): CurrentUser | null {
  const { user } = useAuth()
  return user
}

/**
 * Hook to check if the current user has a specific permission.
 * Returns false if user is not loaded yet.
 */
export function useHasPermission(permission: string): boolean {
  const { user } = useAuth()
  if (!user) return false
  if (user.permissions.includes('*')) return true
  return user.permissions.includes(permission)
}

/**
 * Hook to check if the current user has ANY of the given permissions.
 */
export function useHasAnyPermission(permissions: string[]): boolean {
  const { user } = useAuth()
  if (!user) return false
  if (user.permissions.includes('*')) return true
  return permissions.some((p) => user.permissions.includes(p))
}
