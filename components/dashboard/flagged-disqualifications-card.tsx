'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface FlaggedDisqualification {
  fullName: string
  count: number
  lastAt: string
}

interface FlaggedDisqualificationsCardProps {
  rows: FlaggedDisqualification[]
}

export function FlaggedDisqualificationsCard({ rows }: FlaggedDisqualificationsCardProps) {
  if (!rows || rows.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Late disqualifications (Qualified / Quote Sent → Disqualified)</CardTitle>
        <p className="text-xs text-muted-foreground">
          A real requirement or quote already existed on these leads before they were
          disqualified — worth a quick review per salesperson.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.fullName}
              className="flex items-center justify-between gap-4 rounded-md border border-border p-3"
            >
              <span className="text-sm font-medium">{row.fullName}</span>
              <Badge variant="warning">{row.count} lead{row.count === 1 ? '' : 's'}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
