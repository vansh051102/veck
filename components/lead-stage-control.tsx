'use client'

import { useState } from 'react'
import { api, ApiError } from '@/lib/api-client'
import { NEXT_STAGES, DEAL_LOST_REASONS } from '@/lib/lead-stages'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PermissionGate } from '@/components/permission-gate'

interface Props {
  leadId: string
  currentStage: string
  onChanged: () => void
}

export function LeadStageControl({ leadId, currentStage, onChanged }: Props) {
  const [targetStage, setTargetStage] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const nextOptions = NEXT_STAGES[currentStage] || []
  const isLossPath = targetStage === 'Deal Lost' || targetStage === 'Disqualified'

  async function handleMove() {
    if (!targetStage) return
    setLoading(true)
    setError(null)
    try {
      await api.put(`/leads/${leadId}/stage`, { stage: targetStage, reason: reason || undefined })
      setTargetStage('')
      setReason('')
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to change stage')
    } finally {
      setLoading(false)
    }
  }

  if (nextOptions.length === 0) {
    return (
      <PermissionGate permission="leads:edit">
        <Badge variant="default">Terminal stage — no further transitions</Badge>
      </PermissionGate>
    )
  }

  return (
    <PermissionGate permission="leads:edit">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={targetStage}
            onChange={(e) => setTargetStage(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Move to…</option>
            {nextOptions.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>

          {isLossPath && (
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-label="Loss reason (required)"
              className="h-9 min-w-[200px] rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Reason (required)…</option>
              {DEAL_LOST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}

          <Button
            size="sm"
            disabled={!targetStage || loading || (isLossPath && !reason)}
            onClick={handleMove}
          >
            {loading ? 'Moving…' : 'Confirm'}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </PermissionGate>
  )
}
