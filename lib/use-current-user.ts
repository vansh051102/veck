'use client'

import { useEffect, useState } from 'react'
import { api } from './api-client'

export interface CurrentUser {
  id: string
  email: string
  fullName: string
  role: string
  department: string | null
  designation: string | null
  permissions: string[]
}

interface MeResponse {
  user: CurrentUser
  org: { id: string; name: string }
}

// Module-level cache so multiple components share one /auth/me request.
let cached: CurrentUser | null = null
let inflight: Promise<CurrentUser | null> | null = null
// Mounted useCurrentUser() consumers re-fetch when notified (see
// invalidateCurrentUser) so profile edits propagate without a page reload.
const listeners = new Set<() => void>()

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  if (cached) return cached
  if (!inflight) {
    inflight = api
      .get<MeResponse>('/auth/me')
      .then((res) => {
        cached = res.data?.user ?? null
        return cached
      })
      .catch(() => null)
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/**
 * Clears the module-level cache and tells every mounted useCurrentUser()
 * consumer to re-fetch /auth/me. Call after a self-service profile update
 * so the topbar/sidebar reflect changes (e.g. a new name) without a reload.
 */
export function invalidateCurrentUser(): void {
  cached = null
  listeners.forEach((refetch) => refetch())
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(cached)

  useEffect(() => {
    let cancelled = false
    function load() {
      fetchCurrentUser().then((u) => {
        if (!cancelled) setUser(u)
      })
    }
    load()
    listeners.add(load)
    return () => {
      cancelled = true
      listeners.delete(load)
    }
  }, [])

  return user
}

/**
 * Check if the current user has a specific permission.
 * Returns false if user is not loaded yet.
 */
export function useHasPermission(permission: string): boolean {
  const user = useCurrentUser()
  if (!user) return false
  if (user.permissions.includes('*')) return true
  return user.permissions.includes(permission)
}

/**
 * Check if the current user has ANY of the given permissions.
 */
export function useHasAnyPermission(permissions: string[]): boolean {
  const user = useCurrentUser()
  if (!user) return false
  if (user.permissions.includes('*')) return true
  return permissions.some((p) => user.permissions.includes(p))
}
