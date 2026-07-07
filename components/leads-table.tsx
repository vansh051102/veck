'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { api } from '@/lib/api-client'
import { toFormErrors } from '@/lib/form-errors'
import { otherStages } from '@/lib/lead-stages'
import { LEAD_PRIORITIES } from '@/lib/validation'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils'

export interface LeadRow {
  id: string
  companyName: string
  stage: string
  priority: string
  slaBreached: boolean
  createdAt: string
  lastActivityAt: string
  contact: { firstName: string; lastName: string; email: string } | null
  assignedTo: { id?: string; fullName: string } | null
  assignedToId?: string | null
  // Lead origin: who sourced/created it (marketing attribution)
  createdBy?: { id: string; fullName: string } | null
  source?: string | null
}

export interface OrgUser {
  id: string
  fullName: string
}

export type SortBy =
  | 'createdAt'
  | 'companyName'
  | 'priority'
  | 'stage'
  | 'lastActivityAt'
  | 'slaDeadline'
export type SortDir = 'asc' | 'desc'

export const STAGE_VARIANT: Record<
  string,
  'default' | 'primary' | 'success' | 'warning' | 'destructive'
> = {
  'New Lead': 'default',
  Contacted: 'primary',
  Qualified: 'primary',
  'Quote Sent': 'warning',
  'Closed Won': 'success',
  'Deal Lost': 'destructive',
  Disqualified: 'destructive',
}

export const PRIORITY_VARIANT: Record<string, 'default' | 'warning' | 'destructive'> = {
  Low: 'default',
  Medium: 'default',
  High: 'warning',
  Urgent: 'destructive',
}

const cellSelectClass =
  'h-7 max-w-[140px] rounded-md border border-border bg-background px-1 text-xs outline-none focus:ring-2 focus:ring-primary'

// Simple windowed rendering: with large page sizes only the rows near the
// viewport are mounted; spacer rows keep the scrollbar geometry correct.
const ROW_HEIGHT = 41
const VIRTUALIZE_THRESHOLD = 100
const CONTAINER_HEIGHT = 640
const OVERSCAN = 10

interface LeadsTableProps {
  data: LeadRow[]
  users: OrgUser[]
  selected: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onChanged: () => void
  sortBy: SortBy
  sortDir: SortDir
  onSort: (column: SortBy) => void
}

export function LeadsTable({
  data,
  users,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onChanged,
  sortBy,
  sortDir,
  onSort,
}: LeadsTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const allSelected = data.length > 0 && data.every((l) => selected.has(l.id))
  const virtualize = data.length > VIRTUALIZE_THRESHOLD

  let visible = data
  let topPad = 0
  let bottomPad = 0
  if (virtualize) {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    const count = Math.ceil(CONTAINER_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2
    const end = Math.min(data.length, start + count)
    visible = data.slice(start, end)
    topPad = start * ROW_HEIGHT
    bottomPad = (data.length - end) * ROW_HEIGHT
  }

  function openLead(id: string) {
    router.push(`/leads/${id}`)
  }

  async function inlineUpdate(lead: LeadRow, fn: () => Promise<unknown>, successMsg: string) {
    setBusyId(lead.id)
    try {
      await fn()
      toast(successMsg)
      onChanged()
    } catch (err) {
      toast(toFormErrors(err, 'Update failed').message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  function changeStage(lead: LeadRow, stage: string) {
    inlineUpdate(lead, () => api.put(`/leads/${lead.id}/stage`, { stage }), `Moved to ${stage}`)
  }

  function changePriority(lead: LeadRow, priority: string) {
    inlineUpdate(lead, () => api.put(`/leads/${lead.id}`, { priority }), `Priority: ${priority}`)
  }

  function changeAssignee(lead: LeadRow, assignedToId: string) {
    inlineUpdate(lead, () => api.put(`/leads/${lead.id}/assign`, { assignedToId }), 'Lead reassigned')
  }

  // Inline stage options: any other stage. Loss-path moves (Deal Lost /
  // Disqualified) require a reason, so those go through the detail page.
  function inlineStageOptions(stage: string): string[] {
    return otherStages(stage).filter((s) => s !== 'Deal Lost' && s !== 'Disqualified')
  }

  function SortHeader({ column, children }: { column: SortBy; children: React.ReactNode }) {
    const active = sortBy === column
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
    return (
      <th className="whitespace-nowrap px-4 py-2 font-medium">
        <button
          onClick={() => onSort(column)}
          className="inline-flex items-center gap-1 hover:text-foreground"
          aria-label={`Sort by ${column}`}
        >
          {children}
          <Icon className={`h-3 w-3 ${active ? 'text-foreground' : 'opacity-40'}`} />
        </button>
      </th>
    )
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No leads match these filters.
      </div>
    )
  }

  return (
    <>
      {/* Mobile card view */}
      <div className="flex flex-col gap-2 md:hidden">
        {data.map((lead) => (
          <button
            key={lead.id}
            onClick={() => openLead(lead.id)}
            className="rounded-lg border border-border bg-card p-3 text-left hover:bg-muted"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{lead.companyName}</span>
              {lead.slaBreached && <Badge variant="destructive">SLA</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {lead.contact ? `${lead.contact.firstName} ${lead.contact.lastName}` : 'No contact'} ·{' '}
              {lead.assignedTo?.fullName || 'Unassigned'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={STAGE_VARIANT[lead.stage] || 'default'}>{lead.stage}</Badge>
              <Badge variant={PRIORITY_VARIANT[lead.priority] || 'default'}>{lead.priority}</Badge>
              <span className="ml-auto text-xs text-muted-foreground">
                {formatDate(new Date(lead.lastActivityAt))}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div
        ref={scrollRef}
        onScroll={virtualize ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined}
        style={virtualize ? { maxHeight: CONTAINER_HEIGHT, overflowY: 'auto' } : undefined}
        className="hidden overflow-x-auto rounded-lg border border-border md:block"
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-left text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  aria-label="Select all leads on this page"
                  className="h-4 w-4 rounded border-border"
                />
              </th>
              <SortHeader column="companyName">Company</SortHeader>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Contact</th>
              <SortHeader column="stage">Stage</SortHeader>
              <SortHeader column="priority">Priority</SortHeader>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Assigned To</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Lead By</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">SLA</th>
              <SortHeader column="lastActivityAt">Last Activity</SortHeader>
              <SortHeader column="createdAt">Created</SortHeader>
            </tr>
          </thead>
          <tbody>
            {topPad > 0 && (
              <tr aria-hidden="true">
                <td colSpan={10} style={{ height: topPad, padding: 0 }} />
              </tr>
            )}
            {visible.map((lead) => {
              const stageOptions = inlineStageOptions(lead.stage)
              const busy = busyId === lead.id
              return (
                <tr key={lead.id} className="border-t border-border hover:bg-muted">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => onToggleSelect(lead.id)}
                      aria-label={`Select ${lead.companyName}`}
                      className="h-4 w-4 rounded border-border"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <button
                      onClick={() => openLead(lead.id)}
                      className="font-medium underline-offset-2 hover:underline focus:underline"
                    >
                      {lead.companyName}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {lead.contact ? `${lead.contact.firstName} ${lead.contact.lastName}` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {stageOptions.length === 0 ? (
                      <Badge variant={STAGE_VARIANT[lead.stage] || 'default'}>{lead.stage}</Badge>
                    ) : (
                      <select
                        value={lead.stage}
                        disabled={busy}
                        onChange={(e) => changeStage(lead, e.target.value)}
                        aria-label={`Stage for ${lead.companyName}`}
                        className={cellSelectClass}
                      >
                        <option value={lead.stage}>{lead.stage}</option>
                        {stageOptions.map((s) => (
                          <option key={s} value={s}>
                            → {s}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <select
                      value={lead.priority}
                      disabled={busy}
                      onChange={(e) => changePriority(lead, e.target.value)}
                      aria-label={`Priority for ${lead.companyName}`}
                      className={cellSelectClass}
                    >
                      {LEAD_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <select
                      value={lead.assignedToId || lead.assignedTo?.id || ''}
                      disabled={busy}
                      onChange={(e) => e.target.value && changeAssignee(lead, e.target.value)}
                      aria-label={`Assignee for ${lead.companyName}`}
                      className={cellSelectClass}
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-2 text-muted-foreground"
                    title={lead.source ? `Source: ${lead.source}` : undefined}
                  >
                    {lead.createdBy?.fullName || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {lead.slaBreached ? (
                      <Badge variant="destructive">Breached</Badge>
                    ) : (
                      <Badge variant="success">On track</Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {formatDate(new Date(lead.lastActivityAt))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {formatDate(new Date(lead.createdAt))}
                  </td>
                </tr>
              )
            })}
            {bottomPad > 0 && (
              <tr aria-hidden="true">
                <td colSpan={10} style={{ height: bottomPad, padding: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
