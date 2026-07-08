'use client'

import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCurrentUser } from '@/lib/use-current-user'
import { visibleStagesForRole } from '@/lib/lead-stages'
import { useDashboardData } from '@/components/dashboard/use-dashboard-data'
import { useDashboardRoleGuard } from '@/components/dashboard/use-dashboard-role-guard'
import { RecentLeadsCard } from '@/components/dashboard/recent-leads-card'
import { QuotationChangesCard } from '@/components/dashboard/quotation-changes-card'
import { ViewAsBanner } from '@/components/ViewAsBanner'

export default function AdminDashboardPage() {
  useDashboardRoleGuard()
  const me = useCurrentUser()
  const searchParams = useSearchParams()
  const viewAsUserId = searchParams.get('viewAs') ?? undefined
  const { stats, recentLeads, error, loading } = useDashboardData(viewAsUserId)

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading dashboard…</div>
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>
  }

  return (
    <div className="flex flex-col gap-6">
      {viewAsUserId && <ViewAsBanner viewAsUserId={viewAsUserId} />}
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {me && (
          <p className="text-sm text-muted-foreground mt-1">
            Welcome, {me.fullName}
            {me.department && ` — ${me.department}`}
            {me.designation && `, ${me.designation}`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{stats?.total ?? 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{stats?.open ?? 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>SLA Breached</CardTitle>
          </CardHeader>
          <CardContent>
            <span className={stats?.slaBreached ? 'text-2xl font-semibold text-destructive' : 'text-2xl font-semibold'}>
              {stats?.slaBreached ?? 0}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Closed Won</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{stats?.byStage['Closed Won'] ?? 0}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads by Stage</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {visibleStagesForRole(me?.role ?? 'admin').map((stage) => (
            <Badge key={stage} variant="default">
              {stage}: {stats?.byStage[stage] ?? 0}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <RecentLeadsCard leads={recentLeads} />

      {/* Quotation changes — only shown to admins when data exists */}
      {stats?.recentQuoteSents && stats.recentQuoteSents.length > 0 && (
        <QuotationChangesCard leads={stats.recentQuoteSents} />
      )}
    </div>
  )
}
