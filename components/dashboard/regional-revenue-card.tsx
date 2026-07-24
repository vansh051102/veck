'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

interface RegionalRevenueRow {
  territory: string
  totalOrderValue: number
  leadCount: number
}

export function RegionalRevenueCard({ rows }: { rows: RegionalRevenueRow[] }) {
  if (!rows || rows.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regional revenue</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows
            .slice()
            .sort((a, b) => b.totalOrderValue - a.totalOrderValue)
            .map((row) => (
              <div
                key={row.territory}
                className="flex items-center justify-between gap-4 rounded-md border border-border p-3 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{row.territory}</span>
                  <span className="text-xs text-muted-foreground">{row.leadCount} lead(s)</span>
                </div>
                <span className="font-medium">{formatCurrency(row.totalOrderValue)}</span>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}
