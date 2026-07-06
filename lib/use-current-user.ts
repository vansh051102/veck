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

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(cached)

  useEffect(() => {
    let cancelled = false
    fetchCurrentUser().then((u) => {
      if (!cancelled) setUser(u)
    })
    return () => {
      cancelled = true
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
