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

// A humanized label for the event-type badge.
function typeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Vertical timeline of everything that happened to a lead — creation, stage
// moves (with loss reason + details), calls, messages, reminders, quotes,
// documents. Mirrors the a competitor per-lead Timeline tab.
export function LeadTimeline({ events }: { events: TimelineEvent[] }) {
  const unique = Array.from(new Map(events.map((e) => [e.id, e])).values())

  if (unique.length === 0) {
    return <p className="text-sm text-muted-foreground">No timeline events yet.</p>
  }

  return (
    <ol className="relative flex flex-col gap-5 border-l border-border pl-6">
      {unique.map((event) => {
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
