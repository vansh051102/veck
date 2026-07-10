'use client'

import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MetricCard } from '@/components/ui/metric-card'
import { RecentActivityCard } from '@/components/analytics/recent-activity-card'
import { QuickActionsCard } from '@/components/analytics/quick-actions-card'

interface Kpis {
  totalLeads: number
  openLeads: number
  wonLeads: number
  slaBreached: number
}

interface SalespersonStat {
  userId: string
  name: string
  role: string
  leadsAssigned: number
  leadsWon: number
  conversionRate: number
  activitiesLogged: number
}

interface ActivityDay {
  date: string
  call?: number
  email?: number
  note?: number
  meeting?: number
  task?: number
}

interface AnalyticsData {
  scope: 'team' | 'own'
  kpis: Kpis
  stageDistribution: Record<string, number>
  salespersonStats: SalespersonStat[]
  activityVolume: ActivityDay[]
}

const STAGE_ORDER = [
  'New Lead',
  'Contacted',
  'Qualified',
  'Quote Sent',
  'Order Confirmed',
  'Order Closed',
  'Deal Lost',
  'Disqualified',
]

const ACTIVITY_COLORS: Record<string, string> = {
  call: 'bg-blue-500',
  email: 'bg-purple-500',
  note: 'bg-yellow-500',
  meeting: 'bg-green-500',
  task: 'bg-orange-500',
}

const ACTIVITY_TYPES = ['call', 'email', 'note', 'meeting', 'task'] as const

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<AnalyticsData>('/analytics')
      .then((res) => setData(res.data ?? null))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-muted-foreground">Loading analytics…</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!data) return null

  const { kpis, stageDistribution, salespersonStats, activityVolume } = data

  const maxStageCount = Math.max(...Object.values(stageDistribution), 1)

  // Compute max daily total for bar chart scaling
  const maxDayTotal = Math.max(
    ...activityVolume.map((d) =>
      ACTIVITY_TYPES.reduce((sum, t) => sum + (d[t] ?? 0), 0)
    ),
    1
  )

  return (
    <div className="flex flex-col gap-4">
      <QuickActionsCard showTeamPerformanceLink={salespersonStats.length > 1} />

      <section aria-label="Analytics insights" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total leads" helper="in scope" value={kpis.totalLeads} />
        <MetricCard label="Open leads" helper="active pipeline" value={kpis.openLeads} />
        <MetricCard label="Won" helper="closed won" value={kpis.wonLeads} />
        <MetricCard label="SLA breached" helper="needs follow-up" value={kpis.slaBreached} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Stage Distribution */}
        <Card>
          <CardHeader><CardTitle>Leads by Stage</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {STAGE_ORDER.map((stage) => {
              const count = stageDistribution[stage] ?? 0
              const pct = Math.round((count / maxStageCount) * 100)
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">{stage}</span>
                  <div className="flex-1 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs font-medium">{count}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Activity Volume (last 30 days) */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Volume (last 30 days)</CardTitle>
            <div className="flex flex-wrap gap-3 pt-1">
              {ACTIVITY_TYPES.map((t) => (
                <span key={t} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className={`inline-block h-2 w-2 rounded-full ${ACTIVITY_COLORS[t]}`} />
                  {t}
                </span>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {activityVolume.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity data yet.</p>
            ) : (
              <div className="flex h-28 items-end gap-0.5 overflow-x-auto">
                {activityVolume.map((day) => {
                  const total = ACTIVITY_TYPES.reduce((s, t) => s + (day[t] ?? 0), 0)
                  const heightPct = Math.round((total / maxDayTotal) * 100)
                  return (
                    <div
                      key={day.date}
                      title={`${day.date}: ${total} activities`}
                      className="flex min-w-[6px] flex-1 flex-col justify-end"
                    >
                      <div
                        className="rounded-sm bg-primary opacity-70 hover:opacity-100"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RecentActivityCard />

      {/* Per-salesperson table */}
      <Card id="team-performance">
        <CardHeader>
          <CardTitle>{data.scope === 'team' ? 'Team Performance' : 'My Performance'}</CardTitle>
        </CardHeader>
        <CardContent>
          {salespersonStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Role</th>
                    <th className="pb-2 pr-4 text-right font-medium">Assigned</th>
                    <th className="pb-2 pr-4 text-right font-medium">Won</th>
                    <th className="pb-2 pr-4 text-right font-medium">Win Rate</th>
                    <th className="pb-2 text-right font-medium">Activities</th>
                  </tr>
                </thead>
                <tbody>
                  {salespersonStats
                    .sort((a, b) => b.conversionRate - a.conversionRate)
                    .map((s) => (
                      <tr key={s.userId} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 font-medium">{s.name}</td>
                        <td className="py-2 pr-4">
                          <Badge variant="default">{s.role}</Badge>
                        </td>
                        <td className="py-2 pr-4 text-right">{s.leadsAssigned}</td>
                        <td className="py-2 pr-4 text-right text-green-600">{s.leadsWon}</td>
                        <td className="py-2 pr-4 text-right">
                          <span
                            className={
                              s.conversionRate >= 50
                                ? 'font-medium text-green-600'
                                : s.conversionRate >= 25
                                ? 'font-medium text-yellow-600'
                                : 'text-muted-foreground'
                            }
                          >
                            {s.conversionRate}%
                          </span>
                        </td>
                        <td className="py-2 text-right">{s.activitiesLogged}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
