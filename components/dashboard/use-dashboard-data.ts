'use client'

import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api-client'
import type { DashboardStats, LeadSummary } from './types'

export function useDashboardData(viewAsUserId?: string) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentLeads, setRecentLeads] = useState<LeadSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const suffix = viewAsUserId ? `&viewAsUserId=${viewAsUserId}` : ''

    async function load() {
      try {
        const [statsRes, leadsRes] = await Promise.all([
          api.get<DashboardStats>(`/leads/stats${suffix ? `?${suffix.slice(1)}` : ''}`),
          api.get<LeadSummary[]>(`/leads?limit=5${suffix}`),
        ])
        if (cancelled) return
        setStats(statsRes.data ?? null)
        setRecentLeads(leadsRes.data ?? [])
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Failed to load dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [viewAsUserId])

  return { stats, recentLeads, error, loading }
}
