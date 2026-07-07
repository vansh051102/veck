'use client'

import { useCurrentUser } from '@/lib/use-current-user'
import { useDashboardData } from '@/components/dashboard/use-dashboard-data'
import { useDashboardRoleGuard } from '@/components/dashboard/use-dashboard-role-guard'
import { RecentLeadsCard } from '@/components/dashboard/recent-leads-card'
import { SalesPipelineSection } from '@/components/dashboard/sales-pipeline-section'
import { PurchaseSlaSection } from '@/components/dashboard/purchase-sla-section'

export default function SalesPurchaseDashboardPage() {
  useDashboardRoleGuard()
  const me = useCurrentUser()
  const { stats, recentLeads, error, loading } = useDashboardData()

  if (loading) return <div className="text-sm text-muted-foreground">Loading dashboard…</div>
  if (error) return <div className="text-sm text-destructive">{error}</div>
  if (!stats) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Sales / Purchase Dashboard</h1>
        {me && <p className="text-sm text-muted-foreground mt-1">Welcome, {me.fullName}</p>}
      </div>

      <SalesPipelineSection stats={stats} />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Purchase Queue</h2>
        <PurchaseSlaSection stats={stats} />
      </div>

      <RecentLeadsCard leads={recentLeads} />
    </div>
  )
}
