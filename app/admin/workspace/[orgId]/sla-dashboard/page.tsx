'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'

interface SLABreach {
  leadId: string
  leadName: string
  assignedToUserId: string
  assignedToName: string
  department: string | null
  stage: string
  slaRule: string | null
  targetMinutes: number | null
  elapsedBusinessMinutes: number | null
  deadline: string | null
  status: string
  breachedByMinutes: number | null
  lastUpdated: string
}

interface MetricCard {
  label: string
  value: number
  color: string
}

export default function SLADashboardPage() {
  const { toast } = useToast()
  const [breaches, setBreaches] = useState<SLABreach[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDept, setFilterDept] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'remaining' | 'elapsed'>('remaining')

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get<SLABreach[]>('/reports/sla-breaches')
        setBreaches(res.data ?? [])
      } catch (err) {
        toast('Failed to load SLA breaches', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  const totalLeads = breaches.length
  const breachedCount = breaches.filter((b) => b.status === 'breached').length
  const atRiskCount = breaches.filter((b) => {
    if (!b.targetMinutes || !b.elapsedBusinessMinutes) return false
    return (b.elapsedBusinessMinutes / b.targetMinutes) >= 0.8 && b.status !== 'breached'
  }).length
  const onTrackCount = totalLeads - breachedCount - atRiskCount

  const metrics: MetricCard[] = [
    { label: 'Total Leads', value: totalLeads, color: 'bg-blue-600' },
    { label: 'Breached', value: breachedCount, color: 'bg-red-600' },
    { label: 'At Risk', value: atRiskCount, color: 'bg-yellow-600' },
    { label: 'On Track', value: onTrackCount, color: 'bg-green-600' },
  ]

  const filtered = breaches
    .filter((b) => !filterDept || b.department === filterDept)
    .filter((b) => !filterStatus || b.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === 'remaining') {
        const aTarget = a.targetMinutes || 0
        const aElapsed = a.elapsedBusinessMinutes || 0
        const bTarget = b.targetMinutes || 0
        const bElapsed = b.elapsedBusinessMinutes || 0
        return (bElapsed - bTarget) - (aElapsed - aTarget)
      }
      return (b.elapsedBusinessMinutes || 0) - (a.elapsedBusinessMinutes || 0)
    })

  const depts = Array.from(new Set(breaches.map((b) => b.department).filter(Boolean)))
  const statuses = ['breached', 'overdue', 'pending']

  const getStatusColor = (status: string, elapsed: number, target: number) => {
    if (status === 'breached') return 'text-red-600 bg-red-50'
    if (target && (elapsed / target) >= 0.8) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  if (loading) return <div className="p-4">Loading…</div>

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">SLA Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time SLA breach monitoring</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className={`text-2xl font-bold ${m.color} text-white`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <label className="text-xs font-medium">Department:</label>
        <select
          value={filterDept || ''}
          onChange={(e) => setFilterDept(e.target.value || null)}
          className="h-8 rounded-md border border-border px-2 text-sm"
        >
          <option value="">All</option>
          {depts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <label className="text-xs font-medium ml-4">Status:</label>
        <select
          value={filterStatus || ''}
          onChange={(e) => setFilterStatus(e.target.value || null)}
          className="h-8 rounded-md border border-border px-2 text-sm"
        >
          <option value="">All</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className="text-xs font-medium ml-4">Sort:</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'remaining' | 'elapsed')}
          className="h-8 rounded-md border border-border px-2 text-sm"
        >
          <option value="remaining">Time Remaining (most breached first)</option>
          <option value="elapsed">Elapsed Time</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted">
              <th className="px-4 py-2 text-left">Lead</th>
              <th className="px-4 py-2 text-left">Assigned To</th>
              <th className="px-4 py-2 text-left">Dept</th>
              <th className="px-4 py-2 text-left">Stage</th>
              <th className="px-4 py-2 text-left">Target</th>
              <th className="px-4 py-2 text-left">Elapsed</th>
              <th className="px-4 py-2 text-left">Remaining</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((breach) => {
              const target = breach.targetMinutes || 0
              const elapsed = breach.elapsedBusinessMinutes || 0
              const remaining = Math.max(0, target - elapsed)
              const statusColor = getStatusColor(breach.status, elapsed, target)

              return (
                <tr key={breach.leadId} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-2">{breach.leadName}</td>
                  <td className="px-4 py-2">{breach.assignedToName}</td>
                  <td className="px-4 py-2">{breach.department || '—'}</td>
                  <td className="px-4 py-2">{breach.stage}</td>
                  <td className="px-4 py-2">{target ? `${(target / 60).toFixed(1)}h` : '—'}</td>
                  <td className="px-4 py-2">{elapsed ? `${(elapsed / 60).toFixed(1)}h` : '—'}</td>
                  <td className="px-4 py-2">{target ? `${(remaining / 60).toFixed(1)}h` : '—'}</td>
                  <td className={`px-4 py-2 rounded ${statusColor}`}>
                    <span className="font-medium">{breach.status}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(breach.lastUpdated).toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">
          No SLA records found. All leads are on track! 🎉
        </div>
      )}
    </div>
  )
}
