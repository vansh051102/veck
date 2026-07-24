'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const HORIZON_LABELS: Record<string, string> = {
  next_2_days: 'Next 2 days',
  next_3_days: 'Next 3 days',
  '1_week': '1 week',
  '1_month': '1 month',
  custom: 'Custom date',
}

export function ClosingHorizonCard({ byHorizon }: { byHorizon: Record<string, number> }) {
  const entries = Object.entries(byHorizon)
  if (entries.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline by closing horizon</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {entries.map(([horizon, count]) => (
          <Badge key={horizon} variant="default">
            {HORIZON_LABELS[horizon] ?? horizon}: {count}
          </Badge>
        ))}
      </CardContent>
    </Card>
  )
}
