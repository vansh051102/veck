import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { DashboardStats } from './types'

const SALES_STAGES = [
  'New Lead',
  'Contacted',
  'Qualified',
  'Quote Sent',
  'Order Confirmed',
  'Order Closed',
  'Deal Lost',
]

export function SalesPipelineSection({ stats }: { stats: DashboardStats }) {
  const aging = stats.dealAgingBuckets

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Open Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{stats.open}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Activities This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{stats.activitiesThisWeek ?? 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>SLA Breached</CardTitle>
          </CardHeader>
          <CardContent>
            <span className={stats.slaBreached ? 'text-2xl font-semibold text-destructive' : 'text-2xl font-semibold'}>
              {stats.slaBreached}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline by Stage</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {SALES_STAGES.map((stage) => (
            <Badge key={stage} variant="default">
              {stage}: {stats.byStage[stage] ?? 0}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {aging && (
        <Card>
          <CardHeader>
            <CardTitle>Deal Aging (open leads)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="default">0–7 days: {aging['0-7d']}</Badge>
            <Badge variant="warning">8–30 days: {aging['8-30d']}</Badge>
            <Badge variant="destructive">30+ days: {aging['30d+']}</Badge>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
