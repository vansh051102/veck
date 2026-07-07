'use client'

import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api-client'
import { otherStages, DEAL_LOST_REASONS } from '@/lib/lead-stages'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/permission-gate'
import { useCurrentUser } from '@/lib/use-current-user'

interface Props {
  leadId: string
  currentStage: string
  onChanged: () => void
}

interface OrgUser {
  id: string
  fullName: string
  role: string
}

const SALES_ROLES = ['sales_manager', 'sales_executive', 'sales_purchase']

export function LeadStageControl({ leadId, currentStage, onChanged }: Props) {
  const me = useCurrentUser()
  const [targetStage, setTargetStage] = useState('')
  const [reason, setReason] = useState('')
  const [assignedToId, setAssignedToId] = useState('')
  const [salesUsers, setSalesUsers] = useState<OrgUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const nextOptions = otherStages(currentStage)
  const isLossPath = targetStage === 'Deal Lost' || targetStage === 'Disqualified'
  const isHandover = targetStage === 'Qualified'
  const isMarketing = me?.role.startsWith('marketing') ?? false
  // Marketing must pick a salesperson when qualifying (that's the handover);
  // other roles can qualify without reassigning.
  const handoverRequired = isHandover && isMarketing

  useEffect(() => {
    if (!isHandover || salesUsers.length > 0) return
    api
      .get<OrgUser[]>('/users')
      .then((res) =>
        setSalesUsers((res.data ?? []).filter((u) => SALES_ROLES.includes(u.role)))
      )
      .catch(() => setSalesUsers([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHandover])

  async function handleMove() {
    if (!targetStage) return
    setLoading(true)
    setError(null)
    try {
      await api.put(`/leads/${leadId}/stage`, {
        stage: targetStage,
        reason: reason || undefined,
        assignedToId: (isHandover && assignedToId) || undefined,
      })
      setTargetStage('')
      setReason('')
      setAssignedToId('')
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to change stage')
    } finally {
      setLoading(false)
    }
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

          {isHandover && (
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              aria-label={`Hand over to salesperson${handoverRequired ? ' (required)' : ''}`}
              className="h-9 min-w-[220px] rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">
                {handoverRequired ? 'Hand over to salesperson (required)…' : 'Hand over to (optional)…'}
              </option>
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role.replace('_', ' ')})
                </option>
              ))}
            </select>
          )}

          <Button
            size="sm"
            disabled={
              !targetStage ||
              loading ||
              (isLossPath && !reason) ||
              (handoverRequired && !assignedToId)
            }
            onClick={handleMove}
          >
            {loading ? 'Moving…' : 'Confirm'}
          </Button>
        </div>
        {isHandover && salesUsers.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No sales users found — the lead keeps its current assignee.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </PermissionGate>
  )
}
