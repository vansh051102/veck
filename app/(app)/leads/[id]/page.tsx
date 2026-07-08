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

// The full lead payload: the tabbed panel's fields plus the extra sections
// (checklists, purchase requests) that live under the panel on this page.
interface LeadDetail extends LeadDetailData {
  checklists: {
    id: string
    title: string
    isRequired: boolean
    items: { id: string; title: string; completed: boolean }[]
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
              checklists={lead.checklists}
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
              purchaseRequests={lead.purchaseRequests}
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
