'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Sparkles, ArrowRightLeft, Phone, MessageSquare, FileText, UserCheck, Circle } from 'lucide-react'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'

interface Event {
  id: string
  type: string
  title: string
  description: string | null
  createdAt: string
}

// The cursor point the popover is positioned near — captured on row hover.
export interface PopoverAnchor {
  x: number
  y: number
}

const TYPE_ICON: Record<string, typeof Circle> = {
  lead_created: Sparkles,
  stage_changed: ArrowRightLeft,
  activity_added: Phone,
  contacted: Phone,
  note_added: MessageSquare,
  assigned: UserCheck,
  quote_created: FileText,
  quote_sent: FileText,
  document_added: FileText,
}

function typeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const WIDTH = 320 // must match the w-80 class below
const MARGIN = 12

// Floating card showing a lead's recent timeline activity (the a competitor hover
// dropdown). The leads table owns the hover trigger and passes down which
// lead is hovered plus the cursor anchor; a single instance is rendered per
// table.
//
// Positioned with `fixed` and clamped to the viewport so it's always fully
// visible: it opens to the right of the cursor, but flips to the left when
// that would run off the right edge, and is measured so it never spills off
// the bottom. `fixed` (vs `absolute` inside the table) is required because
// the table's scroll container is `overflow-x-auto`, which also clips the
// y-axis and would otherwise cut the card off.
export function LeadActivityPopover({
  leadId,
  anchor,
}: {
  leadId: string | null
  anchor: PopoverAnchor | null
}) {
  const [events, setEvents] = useState<Event[] | null>(null)
  const [loading, setLoading] = useState(false)
  const fetchedFor = useRef<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const open = leadId !== null && anchor !== null

  useEffect(() => {
    if (!leadId) return
    if (fetchedFor.current === leadId) return
    fetchedFor.current = leadId
    setLoading(true)
    setEvents(null)
    api
      .get<Event[]>(`/leads/${leadId}/timeline?limit=6`)
      .then((res) => setEvents(res.data ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [leadId])

  // Clamp against the viewport. Runs before paint (and again once events load
  // and change the height) so the card never appears off-screen.
  useLayoutEffect(() => {
    if (!open || !anchor || !cardRef.current) {
      setPos(null)
      return
    }
    const h = cardRef.current.getBoundingClientRect().height
    let left = anchor.x + 16
    if (left + WIDTH > window.innerWidth - MARGIN) left = anchor.x - WIDTH - 16
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - WIDTH - MARGIN))
    let top = anchor.y + 12
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - h - MARGIN))
    setPos({ left, top })
  }, [open, anchor, events, loading])

  if (!open) return null

  return (
    <div
      ref={cardRef}
      className="fixed z-40 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-2xl"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Recent activity
      </p>
      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {!loading && events && events.length === 0 && (
        <p className="text-xs text-muted-foreground">No activity yet.</p>
      )}
      {!loading && events && events.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {events.map((e) => {
            const Icon = TYPE_ICON[e.type] ?? Circle
            return (
              <li key={e.id} className="flex gap-2.5 border-b border-border pb-2.5 last:border-0 last:pb-0">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {typeLabel(e.type)}
                    </span>
                    <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                      {formatDate(new Date(e.createdAt))}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium leading-snug">{e.title}</p>
                  {e.description && (
                    <p className="text-xs leading-snug text-muted-foreground">{e.description}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
