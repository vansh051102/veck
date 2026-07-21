'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { useToast } from '@/components/ui/toast'

interface SLABreach {
  leadId: string
  leadName: string
  stage: string
  targetMinutes: number | null
  elapsedBusinessMinutes: number | null
  deadline: string | null
  status: string
}

interface KRAMetric {
  metric: string
  value: number
  target: number | null
}

export default function MySLADashboardPage() {
  const { toast } = useToast()
  const [myLeads, setMyLeads] = useState<SLABreach[]>([])
  const [kraMetrics, setKraMetrics] = useState<KRAMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    async function load() {
      try {
        const breachRes = await api.get<SLABreach[]>('/reports/sla-breaches')
        const allBreaches = breachRes.data ?? []
        const kraRes = await api.get<any[]>('/reports/kra-performance?scope=user')
        const kraData = kraRes.data ?? []

        setMyLeads(allBreaches)
        setKraMetrics(
          kraData.map((k) => ({
            metric: k.metric,
            value: k.value,
            target: k.target,
          }))
        )
      } catch (err) {
        toast('Failed to load SLA data', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  // Live timer update
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const getStatusBadge = (status: string, elapsed: number, target: number) => {
    if (status === 'breached') return { text: '🔴 Breached', color: 'text-red-600' }
    if (target && (elapsed / target) >= 0.8) return { text: '🟡 Warning', color: 'text-yellow-600' }
    return { text: '🟢 On Track', color: 'text-green-600' }
  }

  if (loading) return <div className="p-4">Loading…</div>

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">My SLA Status</h1>
        <p className="text-sm text-muted-foreground">Track your lead SLAs and KRA performance</p>
      </div>

      {/* My Active Leads */}
      <section>
        <h2 className="text-lg font-semibold mb-3">My Active Leads</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted">
                <th className="px-4 py-2 text-left">Lead</th>
                <th className="px-4 py-2 text-left">Stage</th>
                <th className="px-4 py-2 text-left">Target</th>
                <th className="px-4 py-2 text-left">Elapsed</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {myLeads.map((lead) => {
                const target = lead.targetMinutes || 0
                const elapsed = lead.elapsedBusinessMinutes || 0
                const badge = getStatusBadge(lead.status, elapsed, target)

                return (
                  <tr key={lead.leadId} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-2 font-medium">{lead.leadName}</td>
                    <td className="px-4 py-2">{lead.stage}</td>
                    <td className="px-4 py-2">{target ? `${(target / 60).toFixed(1)}h` : '—'}</td>
                    <td className="px-4 py-2">{elapsed ? `${(elapsed / 60).toFixed(1)}h` : '—'}</td>
                    <td className={`px-4 py-2 font-medium ${badge.color}`}>{badge.text}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {myLeads.length === 0 && (
          <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">
            No active leads assigned. Check back soon!
          </div>
        )}
      </section>

      {/* My KRA Metrics */}
      <section>
        <h2 className="text-lg font-semibold mb-3">My Today&apos;s KRA Metrics</h2>
        <div className="grid grid-cols-3 gap-4">
          {kraMetrics.map((kra) => (
            <div key={kra.metric} className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">{kra.metric}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold">{kra.value}</p>
                {kra.target && <p className="text-xs text-muted-foreground">/ {kra.target}</p>}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {kra.target
                  ? `${((kra.value / kra.target) * 100).toFixed(0)}% of target`
                  : 'Collecting data…'}
              </p>
            </div>
          ))}
        </div>

        {kraMetrics.length === 0 && (
          <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">
            No KRA metrics configured for your department yet.
          </div>
        )}
      </section>

      {/* Summary */}
      <section className="text-xs text-muted-foreground">
        <p>Last updated: {currentTime.toLocaleString()}</p>
        <p>Countdown timers refresh every 60 seconds</p>
      </section>
    </div>
  )
}
