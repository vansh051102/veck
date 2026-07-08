'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api-client'
import { useEscapeKey } from '@/lib/use-escape-key'
import {
  LeadDetailPanel,
  type LeadDetailData,
  type SubTab,
} from '@/components/lead-detail-panel'

// Right-side slide-over that loads a lead and renders the full detail panel.
// Opened from the leads list; closes on backdrop click or Escape.
export function LeadDetailDrawer({
  leadId,
  onClose,
  onChanged,
  initialView,
  initialTab,
}: {
  leadId: string
  onClose: () => void
  // Called after any mutation so the underlying list can refresh.
  onChanged?: () => void
  // Which view/sub-tab to open on (set by the leads-list row quick-actions).
  initialView?: 'lead' | 'quotation'
  initialTab?: SubTab
}) {
  const [lead, setLead] = useState<LeadDetailData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await api.get<LeadDetailData>(`/leads/${leadId}`)
      setLead(res.data ?? null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load lead')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    load()
  }, [load])

  // Shared LIFO Escape stack — a reason modal opened over the drawer closes
  // alone; a second Escape then closes the drawer.
  useEscapeKey(onClose)

  const handleChanged = useCallback(() => {
    load()
    onChanged?.()
  }, [load, onChanged])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lead details"
        className="animate-slide-in-right relative flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-border bg-card shadow-2xl"
      >
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading lead…</p>
        ) : error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : lead ? (
          <LeadDetailPanel
            lead={lead}
            onChanged={handleChanged}
            onClose={onClose}
            initialView={initialView}
            initialTab={initialTab}
          />
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Lead not found.</p>
        )}
      </div>
    </div>
  )
}
