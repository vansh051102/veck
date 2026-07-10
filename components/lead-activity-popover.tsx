'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Circle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

// The cursor point the popover is positioned near — captured on row hover.
export interface PopoverAnchor {
  x: number
  y: number
}

const WIDTH = 280
const MARGIN = 12

/**
 * Lightweight hover card — uses list-row fields only.
 * Previously fetched /timeline on every hover (~9s) and sat on "Loading…".
 */
export function LeadActivityPopover({
  leadId,
  anchor,
  preview,
}: {
  leadId: string | null
  anchor: PopoverAnchor | null
  preview?: {
    label?: string | null
    at?: string | null
    stageDetails?: string | null
    companyName?: string
  } | null
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const open = leadId !== null && anchor !== null

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
  }, [open, anchor, preview])

  if (!open) return null

  const label = preview?.label || 'Updated'
  const at = preview?.at ? formatDate(new Date(preview.at)) : null

  return (
    <div
      ref={cardRef}
      className="fixed z-40 w-[280px] rounded-xl border border-border bg-card p-3 shadow-2xl"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Recent activity
      </p>
      <div className="flex gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
          <Circle className="h-3.5 w-3.5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          {preview?.companyName && (
            <p className="truncate text-xs font-semibold">{preview.companyName}</p>
          )}
          <p className="text-xs font-medium leading-snug">
            {label}
            {at ? ` · ${at}` : ''}
          </p>
          {preview?.stageDetails && (
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{preview.stageDetails}</p>
          )}
          <p className="mt-1.5 text-[11px] text-muted-foreground">Open the lead for full timeline</p>
        </div>
      </div>
    </div>
  )
}
