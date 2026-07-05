'use client'

import { useEffect, useState } from 'react'
import { api } from './api-client'

export interface CurrentUser {
  id: string
  email: string
  fullName: string
  role: string
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
