'use client'

import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCurrentUser } from '@/lib/use-current-user'

interface PerformanceStat {
  userId: string
  name: string
  role: string
  leadsAssigned: number
  openLeads: number
  leadsWon: number
  wonThisMonth: number
  slaBreached: number
  conversionRate: number
  activitiesLogged: number
}

interface PerformanceData {
  scope: 'team' | 'own'
  stats: PerformanceStat[]
}

export default function PerformancePage() {
  const me = useCurrentUser()
  const [data, setData] = useState<PerformanceData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<PerformanceData>('/performance')
      .then((res) => setData(res.data ?? null))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load performance'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-muted-foreground">Loading performance…</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!data) return null

  const isTeamView = data.scope === 'team'
  const mine = data.stats.find((s) => s.userId === me?.id) ?? data.stats[0]

  const myCards = mine
    ? [
        { label: 'Assigned leads', value: mine.leadsAssigned },
        { label: 'Open leads', value: mine.openLeads },
        { label: 'Won (all time)', value: mine.leadsWon },
        { label: 'Won this month', value: mine.wonThisMonth },
        { label: 'Win rate', value: `${mine.conversionRate}%` },
        { label: 'Activities logged', value: mine.activitiesLogged },
        { label: 'SLA breaches (open)', value: mine.slaBreached },
      ]
    : []

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{isTeamView ? 'Performance' : 'My Performance'}</h1>

      {/* Own stats - shown to everyone */}
      {mine && (
        <div>
          {isTeamView && (
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">My stats</h2>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {myCards.map((c) => (
              <Card key={c.label}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-semibold">{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Team table - admin only (server never returns other rows otherwise) */}
      {isTeamView && (
        <Card>
          <CardHeader>
            <CardTitle>Team Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Role</th>
                    <th className="pb-2 pr-4 text-right font-medium">Assigned</th>
                    <th className="pb-2 pr-4 text-right font-medium">Open</th>
                    <th className="pb-2 pr-4 text-right font-medium">Won</th>
                    <th className="pb-2 pr-4 text-right font-medium">Win Rate</th>
                    <th className="pb-2 pr-4 text-right font-medium">SLA Breaches</th>
                    <th className="pb-2 text-right font-medium">Activities</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.stats]
                    .sort((a, b) => b.conversionRate - a.conversionRate)
                    .map((s) => (
                      <tr key={s.userId} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 font-medium">
                          {s.name}
                          {s.userId === me?.id && (
                            <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant="default">{s.role}</Badge>
                        </td>
                        <td className="py-2 pr-4 text-right">{s.leadsAssigned}</td>
                        <td className="py-2 pr-4 text-right">{s.openLeads}</td>
                        <td className="py-2 pr-4 text-right text-green-600">{s.leadsWon}</td>
                        <td className="py-2 pr-4 text-right">{s.conversionRate}%</td>
                        <td className="py-2 pr-4 text-right">
                          <span className={s.slaBreached > 0 ? 'text-destructive' : ''}>
                            {s.slaBreached}
                          </span>
                        </td>
                        <td className="py-2 text-right">{s.activitiesLogged}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
