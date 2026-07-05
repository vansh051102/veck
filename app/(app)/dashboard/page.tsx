'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LEAD_STAGES } from '@/lib/validation'

interface LeadStats {
  total: number
  open: number
  slaBreached: number
  byStage: Record<string, number>
}

interface LeadSummary {
  id: string
  companyName: string
  stage: string
  priority: string
  createdAt: string
  contact: { firstName: string; lastName: string } | null
}

export default function DashboardPage() {
  const [stats, setStats] = useState<LeadStats | null>(null)
  const [recentLeads, setRecentLeads] = useState<LeadSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [statsRes, leadsRes] = await Promise.all([
          api.get<LeadStats>('/leads/stats'),
          api.get<LeadSummary[]>('/leads?limit=5'),
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
  }, [])

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading dashboard…</div>
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{stats?.total ?? 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{stats?.open ?? 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>SLA Breached</CardTitle>
          </CardHeader>
          <CardContent>
            <span className={stats?.slaBreached ? 'text-2xl font-semibold text-destructive' : 'text-2xl font-semibold'}>
              {stats?.slaBreached ?? 0}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Closed Won</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{stats?.byStage['Closed Won'] ?? 0}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads by Stage</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {LEAD_STAGES.map((stage) => (
            <Badge key={stage} variant="default">
              {stage}: {stats?.byStage[stage] ?? 0}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {recentLeads.length === 0 && (
            <p className="text-sm text-muted-foreground">No leads yet.</p>
          )}
          {recentLeads.map((lead) => (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}`}
              className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
            >
              <span className="font-medium">{lead.companyName}</span>
              <Badge variant="primary">{lead.stage}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
