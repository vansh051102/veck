'use client'

import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MetricCard } from '@/components/ui/metric-card'
import { useCurrentUser } from '@/lib/use-current-user'

interface CallStats {
  total: number
  connected: number
  notReceived: number
}

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
  calls: CallStats
}

interface CallDay {
  date: string
  total: number
  connected: number
  notReceived: number
}

interface PerformanceData {
  scope: 'team' | 'own'
  stats: PerformanceStat[]
  calls: CallStats & { byDay: CallDay[] }
}

const DAY_FILTERS = [
  { label: 'All time', value: '' },
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '4 months', value: '120' },
]

export default function PerformancePage() {
  const me = useCurrentUser()
  const [data, setData] = useState<PerformanceData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState('30')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    if (!fromDate && !toDate && days) params.set('days', days)
    api
      .get<PerformanceData>(`/performance?${params.toString()}`)
      .then((res) => setData(res.data ?? null))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load performance'))
      .finally(() => setLoading(false))
  }, [days, fromDate, toDate])

  if (loading && !data) return <p className="text-sm text-muted-foreground">Loading performance…</p>
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

  const maxDayTotal = Math.max(...data.calls.byDay.map((d) => d.total), 1)

  return (
    <div className="flex flex-col gap-4">
      {isTeamView && (
        <p className="text-sm text-muted-foreground">Team performance across your workspace</p>
      )}

      {mine && (
        <section aria-label="Performance insights" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {myCards.slice(0, 4).map((c) => (
            <MetricCard key={c.label} label={c.label} value={c.value} />
          ))}
        </section>
      )}
      {mine && myCards.length > 4 && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {myCards.slice(4).map((c) => (
            <MetricCard key={c.label} label={c.label} value={c.value} />
          ))}
        </section>
      )}

      {/* Call activity */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Call activity</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-border" role="group" aria-label="Time range">
              {DAY_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setDays(f.value)
                    setFromDate('')
                    setToDate('')
                  }}
                  aria-pressed={days === f.value && !fromDate && !toDate}
                  className={`px-3 py-1.5 text-sm first:rounded-l-md last:rounded-r-md ${
                    days === f.value && !fromDate && !toDate
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label htmlFor="perf-from" className="text-sm text-muted-foreground">
              From
            </label>
            <input
              id="perf-from"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setDays('')
                setFromDate(e.target.value)
              }}
              className="crm-input"
            />
            <label htmlFor="perf-to" className="text-sm text-muted-foreground">
              To
            </label>
            <input
              id="perf-to"
              type="date"
              value={toDate}
              onChange={(e) => {
                setDays('')
                setToDate(e.target.value)
              }}
              className="crm-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total calls</p>
                <p className="text-2xl font-semibold">{data.calls.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Connected</p>
                <p className="text-2xl font-semibold text-green-600">{data.calls.connected}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Not received</p>
                <p className="text-2xl font-semibold text-destructive">{data.calls.notReceived}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Calls per day</CardTitle>
            </CardHeader>
            <CardContent>
              {data.calls.byDay.length === 0 ? (
                <p className="text-sm text-muted-foreground">No calls logged in this range.</p>
              ) : (
                <div className="flex h-24 items-end gap-0.5 overflow-x-auto">
                  {data.calls.byDay.map((d) => {
                    const heightPct = Math.round((d.total / maxDayTotal) * 100)
                    return (
                      <div
                        key={d.date}
                        title={`${d.date}: ${d.total} calls (${d.connected} connected, ${d.notReceived} not received)`}
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
      </div>

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
                    <th className="pb-2 pr-4 text-right font-medium">Activities</th>
                    <th className="pb-2 pr-4 text-right font-medium">Calls</th>
                    <th className="pb-2 pr-4 text-right font-medium">Connected</th>
                    <th className="pb-2 text-right font-medium">Not Received</th>
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
                        <td className="py-2 pr-4 text-right">{s.activitiesLogged}</td>
                        <td className="py-2 pr-4 text-right">{s.calls.total}</td>
                        <td className="py-2 pr-4 text-right text-green-600">{s.calls.connected}</td>
                        <td className="py-2 text-right text-destructive">{s.calls.notReceived}</td>
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
