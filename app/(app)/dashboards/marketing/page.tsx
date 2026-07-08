'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrentUser } from '@/lib/use-current-user'
import { useDashboardData } from '@/components/dashboard/use-dashboard-data'
import { useDashboardRoleGuard } from '@/components/dashboard/use-dashboard-role-guard'
import { RecentLeadsCard } from '@/components/dashboard/recent-leads-card'
import { ViewAsBanner } from '@/components/ViewAsBanner'

export default function MarketingDashboardPage() {
  return <Suspense><MarketingDashboardPageContent /></Suspense>
}

function MarketingDashboardPageContent() {
  useDashboardRoleGuard()
  const me = useCurrentUser()
  const searchParams = useSearchParams()
  const viewAsUserId = searchParams.get('viewAs') ?? undefined
  const { stats, recentLeads, error, loading } = useDashboardData(viewAsUserId)

  if (loading) return <div className="text-sm text-muted-foreground">Loading dashboard…</div>
  if (error) return <div className="text-sm text-destructive">{error}</div>
  if (!stats) return null

  return (
    <div className="flex flex-col gap-6">
      {viewAsUserId && <ViewAsBanner viewAsUserId={viewAsUserId} />}
      <div>
        <h1 className="text-2xl font-semibold">Marketing Dashboard</h1>
        {me && <p className="text-sm text-muted-foreground mt-1">Welcome, {me.fullName}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>New Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{stats.newLeadCount ?? 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contacted</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{stats.contactedCount ?? 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Qualified</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{stats.qualifiedCount ?? 0}</span>
          </CardContent>
        </Card>
      </div>

      <RecentLeadsCard leads={recentLeads} />
    </div>
  )
}
