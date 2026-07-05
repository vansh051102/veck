'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { toFormErrors } from '@/lib/form-errors'
import { NEXT_STAGES } from '@/lib/lead-stages'
import { LEAD_STAGES } from '@/lib/validation'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { PRIORITY_VARIANT, type LeadRow } from '@/components/leads-table'

interface LeadsKanbanProps {
  data: LeadRow[]
  onChanged: () => void
}

export function LeadsKanban({ data, onChanged }: LeadsKanbanProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  const byStage = new Map<string, LeadRow[]>()
  for (const stage of LEAD_STAGES) byStage.set(stage, [])
  for (const lead of data) byStage.get(lead.stage)?.push(lead)

  async function moveStage(lead: LeadRow, stage: string) {
    setBusyId(lead.id)
    try {
      await api.put(`/leads/${lead.id}/stage`, { stage })
      toast(`Moved to ${stage}`)
      onChanged()
    } catch (err) {
      toast(toFormErrors(err, 'Failed to move lead').message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {LEAD_STAGES.map((stage) => {
        const leads = byStage.get(stage) || []
        return (
          <div key={stage} className="w-64 shrink-0 rounded-lg border border-border bg-muted/50">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-sm font-medium">{stage}</span>
              <span className="text-xs text-muted-foreground">{leads.length}</span>
            </div>
            <div className="flex min-h-[80px] flex-col gap-2 p-2">
              {leads.map((lead) => {
                // Forward moves only; loss-path needs a reason (detail page)
                const moves = (NEXT_STAGES[lead.stage] || []).filter(
                  (s) => s !== 'Deal Lost' && s !== 'Disqualified'
                )
                return (
                  <div key={lead.id} className="rounded-md border border-border bg-card p-2 text-sm">
                    <button
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      className="w-full text-left font-medium underline-offset-2 hover:underline focus:underline"
                    >
                      {lead.companyName}
                    </button>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {lead.contact
                        ? `${lead.contact.firstName} ${lead.contact.lastName}`
                        : 'No contact'}{' '}
                      · {lead.assignedTo?.fullName || 'Unassigned'}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Badge variant={PRIORITY_VARIANT[lead.priority] || 'default'}>
                        {lead.priority}
                      </Badge>
                      {lead.slaBreached && <Badge variant="destructive">SLA</Badge>}
                      {moves.length > 0 && (
                        <select
                          value=""
                          disabled={busyId === lead.id}
                          onChange={(e) => e.target.value && moveStage(lead, e.target.value)}
                          aria-label={`Move ${lead.companyName} to another stage`}
                          className="ml-auto h-6 rounded border border-border bg-background px-1 text-xs outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Move…</option>
                          {moves.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )
              })}
              {leads.length === 0 && (
                <p className="px-1 py-2 text-xs text-muted-foreground">No leads</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
