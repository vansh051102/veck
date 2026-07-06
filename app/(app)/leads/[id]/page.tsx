'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api, ApiError } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LeadStageControl } from '@/components/lead-stage-control'
import { LeadChecklists } from '@/components/lead-checklists'
import { LeadActivities } from '@/components/lead-activities'
import { LeadAssignControl } from '@/components/lead-assign-control'
import { LeadQuotes } from '@/components/lead-quotes'
import { LeadPurchaseRequests } from '@/components/lead-purchase-requests'
import { formatDate, isSlaOverdue } from '@/lib/utils'

interface LeadDetail {
  id: string
  companyName: string
  stage: string
  priority: string
  status: string
  notes: string | null
  slaDeadline: string
  slaBreached: boolean
  createdAt: string
  assignedToId: string | null
  contact: { firstName: string; lastName: string; email: string; phone: string } | null
  assignedTo: { fullName: string; email: string } | null
  createdBy: { fullName: string } | null
  checklists: {
    id: string
    title: string
    isRequired: boolean
    items: { id: string; title: string; completed: boolean }[]
  }[]
  activities: { id: string; type: string; title: string; description: string | null; status: string; createdAt: string }[]
  timeline: { events: { id: string; type: string; title: string; description: string | null; createdAt: string }[] } | null
  quotes: {
    id: string
    quoteNumber: string
    status: string
    finalAmount: string
    validUntil: string
  }[]
  purchaseRequests: {
    id: string
    prNumber: string
    status: string
    estimatedAmount: string
    estimatedQuantity: number
  }[]
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>()
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await api.get<LeadDetail>(`/leads/${params.id}`)
      setLead(res.data ?? null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load lead')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="text-sm text-muted-foreground">Loading lead…</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!lead) return <p className="text-sm text-muted-foreground">Lead not found.</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{lead.companyName}</h1>
          <p className="text-sm text-muted-foreground">
            {lead.contact ? `${lead.contact.firstName} ${lead.contact.lastName} · ${lead.contact.email}` : 'No contact linked'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="primary">{lead.stage}</Badge>
          {(() => {
            const breached = lead.slaBreached || isSlaOverdue(lead.slaDeadline)
            return (
              <Badge variant={breached ? 'destructive' : 'success'}>
                {breached ? 'SLA Breached' : `SLA due ${formatDate(new Date(lead.slaDeadline))}`}
              </Badge>
            )
          })()}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadStageControl leadId={lead.id} currentStage={lead.stage} onChanged={load} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadActivities leadId={lead.id} activities={lead.activities} onChanged={load} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quotes</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadQuotes leadId={lead.id} quotes={lead.quotes} onChanged={load} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Purchase Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadPurchaseRequests leadId={lead.id} purchaseRequests={lead.purchaseRequests} onChanged={load} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {!lead.timeline?.events?.length && (
                <p className="text-sm text-muted-foreground">No timeline events yet.</p>
              )}
              {Array.from(
                new Map(lead.timeline?.events.map((e) => [e.id, e])).values()
              ).map((event) => (
                <div key={event.id} className="flex items-start justify-between border-b border-border py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{event.title}</p>
                    {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(new Date(event.createdAt))}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority</span>
                <span>{lead.priority}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Assigned to</span>
                <LeadAssignControl
                  leadId={lead.id}
                  assignedToId={lead.assignedToId}
                  assignedToName={lead.assignedTo?.fullName ?? null}
                  onChanged={load}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created by</span>
                <span>{lead.createdBy?.fullName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(new Date(lead.createdAt))}</span>
              </div>
              {lead.notes && (
                <div className="pt-2">
                  <span className="text-muted-foreground">Notes</span>
                  <p className="mt-1">{lead.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklists</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadChecklists leadId={lead.id} checklists={lead.checklists} onChanged={load} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
