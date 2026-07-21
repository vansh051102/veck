'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api, ApiError } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/permission-gate'
import { LeadChecklists } from '@/components/lead-checklists'
import { LeadPurchaseRequests } from '@/components/lead-purchase-requests'
import { LeadDetailPanel, type LeadDetailData } from '@/components/lead-detail-panel'

// GET /leads/:id deliberately keeps its payload lean — checklists and purchase
// requests are unbounded and were pulled out of it to stop the response
// stalling under load (see the comment in that route). They are fetched here
// from their own endpoints instead; previously this page declared them on the
// lead payload and read lead.checklists, which was always undefined and threw
// before anything on the page could render.
type LeadDetail = LeadDetailData

interface Checklist {
  id: string
  title: string
  isRequired: boolean
  items: { id: string; title: string; completed: boolean }[]
}

interface PurchaseRequest {
  id: string
  prNumber: string
  status: string
  estimatedAmount: string
  estimatedQuantity: number
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>()
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      // The lead itself decides whether the page renders at all; the two side
      // sections are fetched alongside it but must not be able to blank the
      // page if they fail, so they settle independently and fall back to [].
      const [leadRes, checklistRes, prRes] = await Promise.all([
        api.get<LeadDetail>(`/leads/${params.id}`),
        api.get<Checklist[]>(`/leads/${params.id}/checklists`).catch(() => null),
        api.get<PurchaseRequest[]>(`/leads/${params.id}/purchase-requests`).catch(() => null),
      ])
      setLead(leadRes.data ?? null)
      setChecklists(checklistRes?.data ?? [])
      setPurchaseRequests(prRes?.data ?? [])
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
      {/* Bounded height so the panel's internal scroll (min-h-0 flex child)
          engages instead of collapsing to zero on this unbounded page. */}
      <div className="h-[calc(100vh-8rem)] min-h-[28rem] overflow-hidden rounded-lg border border-border bg-card">
        <LeadDetailPanel lead={lead} onChanged={load} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Checklists</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadChecklists
              leadId={lead.id}
              checklists={checklists}
              onChanged={load}
              renderActions={(onShow) => (
                <PermissionGate permission="checklists:create">
                  <Button size="sm" variant="outline" onClick={onShow}>
                    New checklist
                  </Button>
                </PermissionGate>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Purchase Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadPurchaseRequests
              leadId={lead.id}
              purchaseRequests={purchaseRequests}
              onChanged={load}
              renderActions={(onShow) => (
                <PermissionGate permission="purchase_requests:create">
                  <Button size="sm" variant="outline" onClick={onShow}>
                    New purchase request
                  </Button>
                </PermissionGate>
              )}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
