'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Download, LayoutGrid, List, Plus, Upload, SlidersHorizontal } from 'lucide-react'
import { api, ApiError } from '@/lib/api-client'
import { toFormErrors } from '@/lib/form-errors'
import { LeadsTable, type LeadRow, type OrgUser, type SortBy, type SortDir } from '@/components/leads-table'
import { LeadsKanban } from '@/components/leads-kanban'
import { LeadsImportModal } from '@/components/leads-import-modal'
import { AssignmentRulesModal } from '@/components/assignment-rules-modal'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { NewLeadForm } from '@/components/new-lead-form'
import { useCurrentUser } from '@/lib/use-current-user'
import { PermissionGate } from '@/components/permission-gate'
import { LEAD_PRIORITIES } from '@/lib/validation'
import { leadTabsForRole } from '@/lib/lead-stages'

const DAY_FILTERS = [
  { label: 'All time', value: '' },
  { label: '7d', value: '7' },
  { label: '30d', value: '30' },
  { label: '90d', value: '90' },
]

interface LeadStats {
  total: number
  open: number
  hot: number
  wonThisMonth: number
  slaBreached: number
  byStage: Record<string, number>
  contactOutcome?: { connected: number; notReceived: number }
}

const filterControlClass =
  'h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary'

export default function LeadsPage() {
  return <Suspense><LeadsPageContent /></Suspense>
}

function LeadsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const me = useCurrentUser()

  const leadTabs = leadTabsForRole(me?.role ?? 'admin')

  const STORAGE_KEY = 'leads-filters'

  // Read initial filter values: URL params take priority, then sessionStorage.
  // useMemo runs synchronously so state is initialised correctly on first render,
  // avoiding the two-render race that caused filter resets with the old useEffect approach.
  const initialFilters = useMemo(() => {
    const hasUrlParams = searchParams.size > 0
    if (hasUrlParams) {
      const p = searchParams.get('page')
      return {
        stage: searchParams.get('stage') ?? '',
        contactOutcome: searchParams.get('contactOutcome') ?? '',
        priority: searchParams.get('priority') ?? '',
        days: searchParams.get('days') ?? '',
        fromDate: searchParams.get('from') ?? '',
        toDate: searchParams.get('to') ?? '',
        search: searchParams.get('search') ?? '',
        sortBy: (searchParams.get('sortBy') as SortBy) ?? 'createdAt',
        sortDir: (searchParams.get('sortDir') as SortDir) ?? 'desc',
        view: (searchParams.get('view') as 'list' | 'kanban') ?? 'list',
        page: p && /^\d+$/.test(p) ? Number(p) : 1,
      }
    }
    try {
      const cached = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}')
      return {
        stage: cached.stage ?? '',
        contactOutcome: cached.contactOutcome ?? '',
        priority: cached.priority ?? '',
        days: cached.days ?? '',
        fromDate: cached.fromDate ?? '',
        toDate: cached.toDate ?? '',
        search: cached.search ?? '',
        sortBy: cached.sortBy ?? 'createdAt',
        sortDir: cached.sortDir ?? 'desc',
        view: cached.view ?? 'list',
        page: cached.page ?? 1,
      }
    } catch {
      return { stage: '', contactOutcome: '', priority: '', days: '', fromDate: '', toDate: '', search: '', sortBy: 'createdAt' as SortBy, sortDir: 'desc' as SortDir, view: 'list' as const, page: 1 }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — only run once on mount

  const initialized = useRef(false)
  const [view, setView] = useState<'list' | 'kanban'>(initialFilters.view)
  const [showNewLead, setShowNewLead] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [users, setUsers] = useState<OrgUser[]>([])
  const [stats, setStats] = useState<LeadStats | null>(null)
  const [page, setPage] = useState(initialFilters.page)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [stage, setStage] = useState(initialFilters.stage)
  const [contactOutcome, setContactOutcome] = useState(initialFilters.contactOutcome)
  const [priority, setPriority] = useState(initialFilters.priority)
  const [days, setDays] = useState(initialFilters.days)
  const [fromDate, setFromDate] = useState(initialFilters.fromDate)
  const [toDate, setToDate] = useState(initialFilters.toDate)
  const [search, setSearch] = useState(initialFilters.search)
  const [sortBy, setSortBy] = useState<SortBy>(initialFilters.sortBy)
  const [sortDir, setSortDir] = useState<SortDir>(initialFilters.sortDir)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // Sync filters back to URL whenever they change. Skip the very first render
  // (initialized.current is false) so we don't clobber a URL that was just read.
  // Also persist to sessionStorage so sidebar navigation restores filters.
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      return
    }
    const params = new URLSearchParams()
    if (stage) params.set('stage', stage)
    if (contactOutcome) params.set('contactOutcome', contactOutcome)
    if (priority) params.set('priority', priority)
    if (days) params.set('days', days)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    if (search) params.set('search', search)
    if (page > 1) params.set('page', String(page))
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy)
    if (sortDir !== 'desc') params.set('sortDir', sortDir)
    if (view !== 'list') params.set('view', view)
    const qs = params.toString()
    router.replace(`/leads${qs ? `?${qs}` : ''}`, { scroll: false })

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        stage, contactOutcome, priority, days, fromDate, toDate,
        search, page, sortBy, sortDir, view,
      }))
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, contactOutcome, priority, days, fromDate, toDate, search, page, sortBy, sortDir, view])

  useEffect(() => {
    api
      .get<OrgUser[]>('/users')
      .then((res) => setUsers(res.data ?? []))
      .catch(() => setUsers([]))
  }, [])

  useEffect(() => {
    api
      .get<LeadStats>('/leads/stats')
      .then((res) => setStats(res.data ?? null))
      .catch(() => setStats(null))
  }, [refreshKey])

  function buildFilterParams(): URLSearchParams {
    const params = new URLSearchParams()
    if (stage) params.set('stage', stage)
    if (contactOutcome) params.set('contactOutcome', contactOutcome)
    if (priority) params.set('priority', priority)
    if (days) params.set('days', days)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    if (search) params.set('search', search)
    return params
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const params = buildFilterParams()
      params.set('page', String(page))
      params.set('limit', view === 'kanban' ? '100' : '20')
      params.set('sortBy', sortBy)
      params.set('sortDir', sortDir)

      try {
        const res = await api.get<LeadRow[]>(`/leads?${params.toString()}`)
        if (cancelled) return
        setLeads(res.data ?? [])
        setTotalPages(res.pagination?.totalPages ?? 1)
        setTotal(res.pagination?.total ?? 0)
        setSelected(new Set())
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Failed to load leads')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const debounce = setTimeout(load, search ? 300 : 0)
    return () => {
      cancelled = true
      clearTimeout(debounce)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, stage, contactOutcome, priority, days, fromDate, toDate, search, sortBy, sortDir, view, refreshKey])

  function handleSort(column: SortBy) {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortDir(column === 'companyName' ? 'asc' : 'desc')
    }
  }

  function handleExport() {
    // Session-cookie authenticated download; middleware attaches user context
    window.location.href = `/api/v1/leads/export?${buildFilterParams().toString()}`
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === leads.length ? new Set() : new Set(leads.map((l) => l.id))))
  }

  async function bulkRun(fn: (id: string) => Promise<unknown>, successMsg: string) {
    setBulkBusy(true)
    const ids = Array.from(selected)
    const results = await Promise.allSettled(ids.map(fn))
    const failed = results.filter((r) => r.status === 'rejected').length
    setBulkBusy(false)
    if (failed > 0) {
      const firstError = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
      toast(
        `${failed}/${ids.length} failed: ${toFormErrors(firstError.reason, 'Update failed').message}`,
        'error'
      )
    } else {
      toast(successMsg)
    }
    refresh()
  }

  function bulkAssign(assignedToId: string) {
    bulkRun((id) => api.put(`/leads/${id}/assign`, { assignedToId }), `${selected.size} lead(s) reassigned`)
  }

  function bulkPriority(p: string) {
    bulkRun((id) => api.put(`/leads/${id}`, { priority: p }), `${selected.size} lead(s) set to ${p}`)
  }

  const metricCards = stats
    ? [
        { label: 'Total leads', value: stats.total },
        { label: 'Open', value: stats.open },
        { label: 'Hot / Urgent', value: stats.hot },
        { label: 'Won this month', value: stats.wonThisMonth },
      ]
    : []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border" role="group" aria-label="View mode">
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button
              variant={view === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('kanban')}
              aria-pressed={view === 'kanban'}
            >
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </Button>
          </div>
          <PermissionGate permission="settings:edit">
            <Button variant="outline" size="sm" onClick={() => setShowRules(true)}>
              <SlidersHorizontal className="h-4 w-4" />
              Assignment Rules
            </Button>
          </PermissionGate>
          <PermissionGate permission="leads:import">
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4" />
              Import
            </Button>
          </PermissionGate>
          <PermissionGate permission="leads:export">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </PermissionGate>
          <PermissionGate permission="leads:create">
            <Button size="sm" onClick={() => setShowNewLead(true)}>
              <Plus className="h-4 w-4" />
              New Lead
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Metrics bar */}
      {metricCards.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metricCards.map((m) => (
            <Card key={m.label}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className="text-2xl font-semibold">{m.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showNewLead && (
        <Modal title="New Lead" onClose={() => setShowNewLead(false)}>
          <NewLeadForm
            onCreated={(leadId) => {
              setShowNewLead(false)
              router.push(`/leads/${leadId}`)
            }}
          />
        </Modal>
      )}

      {showImport && <LeadsImportModal onClose={() => setShowImport(false)} onImported={refresh} />}

      {showRules && <AssignmentRulesModal onClose={() => setShowRules(false)} />}

      {/* Stage tabs */}
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-1 border-b border-border" role="tablist" aria-label="Lead stages">
          {leadTabs.map((tab) => {
            const tabStage = tab.stage ?? ''
            const tabOutcome = tab.contactOutcome ?? ''
            const active = stage === tabStage && contactOutcome === tabOutcome
            const count = !tab.stage
              ? stats?.total
              : tab.contactOutcome === 'connected'
              ? stats?.contactOutcome?.connected ?? 0
              : tab.contactOutcome === 'not_received'
              ? stats?.contactOutcome?.notReceived ?? 0
              : stats?.byStage?.[tab.stage] ?? 0
            return (
              <button
                key={tab.label}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setPage(1)
                  setStage(tabStage)
                  setContactOutcome(tabOutcome)
                }}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                  active
                    ? 'border-primary font-medium text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {count !== undefined && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="lead-search" className="sr-only">
          Search leads
        </label>
        <input
          id="lead-search"
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
          placeholder="Search company or notes…"
          className={`${filterControlClass} min-w-[200px] flex-1`}
        />
        <label htmlFor="lead-priority-filter" className="sr-only">
          Filter by priority
        </label>
        <select
          id="lead-priority-filter"
          value={priority}
          onChange={(e) => {
            setPage(1)
            setPriority(e.target.value)
          }}
          className={filterControlClass}
        >
          <option value="">All priorities</option>
          {LEAD_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className="flex rounded-md border border-border" role="group" aria-label="Time range">
          {DAY_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setPage(1)
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
        <label htmlFor="lead-from" className="text-sm text-muted-foreground">
          From
        </label>
        <input
          id="lead-from"
          type="date"
          value={fromDate}
          onChange={(e) => {
            setPage(1)
            setDays('')
            setFromDate(e.target.value)
          }}
          className={filterControlClass}
        />
        <label htmlFor="lead-to" className="text-sm text-muted-foreground">
          To
        </label>
        <input
          id="lead-to"
          type="date"
          value={toDate}
          onChange={(e) => {
            setPage(1)
            setDays('')
            setToDate(e.target.value)
          }}
          className={filterControlClass}
        />
      </div>

      {/* Bulk action bar */}
      <PermissionGate permission="leads:assign">
        {view === 'list' && selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm">
            <span className="font-medium">{selected.size} selected</span>
            <label htmlFor="bulk-assign" className="sr-only">
              Bulk assign to user
            </label>
            <select
              id="bulk-assign"
              value=""
              disabled={bulkBusy}
              onChange={(e) => e.target.value && bulkAssign(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Assign to…</option>
              {me && <option value={me.id}>Me ({me.fullName})</option>}
              {users
                .filter((u) => u.id !== me?.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
            </select>
            <label htmlFor="bulk-priority" className="sr-only">
              Bulk set priority
            </label>
            <select
              id="bulk-priority"
              value=""
              disabled={bulkBusy}
              onChange={(e) => e.target.value && bulkPriority(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Set priority…</option>
              {LEAD_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}
      </PermissionGate>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading leads…</p>
      ) : view === 'kanban' ? (
        <LeadsKanban data={leads} onChanged={refresh} />
      ) : (
        <>
          <LeadsTable
            data={leads}
            users={users}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onChanged={refresh}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
          />

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total} lead{total === 1 ? '' : 's'}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p: number) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
