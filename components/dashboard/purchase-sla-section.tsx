import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardStats } from './types'

export function PurchaseSlaSection({ stats }: { stats: DashboardStats }) {
  const avgHours = stats.avgQualifiedToQuoteSentHours

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Awaiting Quote (Qualified)</CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-2xl font-semibold">{stats.byStage['Qualified'] ?? 0}</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Quote Sent</CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-2xl font-semibold">{stats.byStage['Quote Sent'] ?? 0}</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Avg. Qualified → Quote Sent</CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-2xl font-semibold">
            {avgHours == null ? 'N/A' : `${avgHours}h`}
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
