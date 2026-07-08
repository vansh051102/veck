'use client'

import {
  Sparkles,
  ArrowRightLeft,
  Phone,
  MessageSquare,
  FileText,
  UserCheck,
  ShoppingCart,
  Circle,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

export interface TimelineEvent {
  id: string
  type: string
  title: string
  description: string | null
  createdAt: string
  metadata?: Record<string, unknown> | null
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
  purchase_request_created: ShoppingCart,
}

const COMMUNICATION_TYPES = new Set(['activity_added', 'contacted', 'note_added', 'document_added'])
const STAGE_HISTORY_TYPES = new Set(['lead_created', 'stage_changed', 'assigned', 'quote_created', 'quote_sent', 'purchase_request_created'])

function typeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function TimelineSection({ events, emptyText }: { events: TimelineEvent[]; emptyText: string }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }
  return (
    <ol className="relative flex flex-col gap-5 border-l border-border pl-6">
      {events.map((event) => {
        const Icon = TYPE_ICON[event.type] ?? Circle
        return (
          <li key={event.id} className="relative">
            <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card">
              <Icon className="h-3.5 w-3.5 text-primary" />
            </span>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {typeLabel(event.type)}
                </span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDate(new Date(event.createdAt))}
                </span>
              </div>
              <p className="text-sm font-medium">{event.title}</p>
              {event.description && (
                <p className="text-sm text-muted-foreground">{event.description}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function LeadTimeline({ events }: { events: TimelineEvent[] }) {
  const unique = Array.from(new Map(events.map((e) => [e.id, e])).values())

  const communications = unique.filter((e) => COMMUNICATION_TYPES.has(e.type))
  const stageHistory = unique.filter((e) => STAGE_HISTORY_TYPES.has(e.type))
  // Unknown types fall into stage history as a safe default
  const unknownEvents = unique.filter((e) => !COMMUNICATION_TYPES.has(e.type) && !STAGE_HISTORY_TYPES.has(e.type))
  const stageWithUnknown = [...stageHistory, ...unknownEvents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Communications</h3>
        <TimelineSection events={communications} emptyText="No calls, messages, or notes logged yet." />
      </div>
      <div className="border-t border-border pt-6">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Stage History</h3>
        <TimelineSection events={stageWithUnknown} emptyText="No stage changes yet." />
      </div>
    </div>
  )
}
