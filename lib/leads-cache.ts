import { api } from '@/lib/api-client'
import type { LeadRow } from '@/components/leads-table'
import type { LeadTab } from '@/lib/lead-stages'

export interface LeadListResult {
  data: LeadRow[]
  total: number
  totalPages: number
  fetchedAt: number
}

export interface LeadListQuery {
  stage?: string
  contactOutcome?: string
  priority?: string
  days?: string
  fromDate?: string
  toDate?: string
  search?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: string
  view?: 'list' | 'kanban'
}

type Listener = () => void

const cache = new Map<string, LeadListResult>()
const inflight = new Map<string, Promise<LeadListResult>>()
const listeners = new Set<Listener>()

export function leadCacheKey(q: LeadListQuery): string {
  return [
    q.stage ?? '',
    q.contactOutcome ?? '',
    q.priority ?? '',
    q.days ?? '',
    q.fromDate ?? '',
    q.toDate ?? '',
    q.search ?? '',
    String(q.page ?? 1),
    String(q.pageSize ?? 50),
    q.sortBy ?? 'createdAt',
    q.sortDir ?? 'desc',
    q.view ?? 'list',
  ].join('|')
}

function notify() {
  listeners.forEach((l) => l())
}

export function subscribeLeadsCache(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getCachedLeads(q: LeadListQuery): LeadListResult | null {
  return cache.get(leadCacheKey(q)) ?? null
}

export function setCachedLeads(q: LeadListQuery, result: LeadListResult) {
  cache.set(leadCacheKey(q), result)
  notify()
}

export function invalidateLeadsCache() {
  cache.clear()
  inflight.clear()
  notify()
}

function buildParams(q: LeadListQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (q.stage) params.set('stage', q.stage)
  if (q.contactOutcome) params.set('contactOutcome', q.contactOutcome)
  if (q.priority) params.set('priority', q.priority)
  if (q.days) params.set('days', q.days)
  if (q.fromDate) params.set('from', q.fromDate)
  if (q.toDate) params.set('to', q.toDate)
  if (q.search) params.set('search', q.search)
  params.set('page', String(q.page ?? 1))
  params.set('limit', q.view === 'kanban' ? '100' : String(q.pageSize ?? 50))
  params.set('sortBy', q.sortBy ?? 'createdAt')
  params.set('sortDir', q.sortDir ?? 'desc')
  return params
}

export async function fetchLeads(q: LeadListQuery, opts?: { force?: boolean }): Promise<LeadListResult> {
  const key = leadCacheKey(q)
  if (!opts?.force) {
    const hit = cache.get(key)
    if (hit) return hit
    const pending = inflight.get(key)
    if (pending) return pending
  }

  const promise = (async () => {
    const res = await api.get<LeadRow[]>(`/leads?${buildParams(q).toString()}`)
    const result: LeadListResult = {
      data: res.data ?? [],
      total: res.pagination?.total ?? 0,
      totalPages: res.pagination?.totalPages ?? 1,
      fetchedAt: Date.now(),
    }
    cache.set(key, result)
    notify()
    return result
  })().finally(() => {
    inflight.delete(key)
  })

  inflight.set(key, promise)
  return promise
}

/** Prefetch every stage tab for the current non-stage filters (page 1). */
export async function prefetchLeadTabs(
  tabs: LeadTab[],
  base: Omit<LeadListQuery, 'stage' | 'contactOutcome' | 'page'>,
  opts?: { force?: boolean }
) {
  const jobs = tabs.map((tab) =>
    fetchLeads(
      {
        ...base,
        stage: tab.stage ?? '',
        contactOutcome: tab.contactOutcome ?? '',
        page: 1,
      },
      opts
    ).catch(() => null)
  )
  await Promise.all(jobs)
}
