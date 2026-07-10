'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCurrentUser } from '@/lib/use-current-user'
import { useDashboardData } from '@/components/dashboard/use-dashboard-data'
import { useDashboardRoleGuard } from '@/components/dashboard/use-dashboard-role-guard'
import { RecentLeadsCard } from '@/components/dashboard/recent-leads-card'
import { SalesPipelineSection } from '@/components/dashboard/sales-pipeline-section'
import { PurchaseSlaSection } from '@/components/dashboard/purchase-sla-section'
import { ViewAsBanner } from '@/components/ViewAsBanner'

export default function SalesPurchaseDashboardPage() {
  return <Suspense><SalesPurchaseDashboardPageContent /></Suspense>
}

function SalesPurchaseDashboardPageContent() {
  useDashboardRoleGuard()
  const me = useCurrentUser()
  const searchParams = useSearchParams()
  const viewAsUserId = searchParams.get('viewAs') ?? undefined
  const { stats, recentLeads, error, loading } = useDashboardData(viewAsUserId)

  if (loading) return <div className="text-sm text-muted-foreground">Loading dashboard…</div>
  if (error) return <div className="text-sm text-destructive">{error}</div>
  if (!stats) return null

  return (
    <div className="flex flex-col gap-4">
      {viewAsUserId && <ViewAsBanner viewAsUserId={viewAsUserId} />}
      {me && <p className="text-sm text-muted-foreground">Welcome, {me.fullName}</p>}

      <SalesPipelineSection stats={stats} />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Purchase Queue</h2>
        <PurchaseSlaSection stats={stats} />
      </div>

      <RecentLeadsCard leads={recentLeads} />
    </div>
  )
}
