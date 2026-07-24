'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface ImportExportRow {
  id: string
  action: string
  resourceName: string | null
  userFullName: string
  timestamp: string
}

export function ImportExportActivityCard({ rows }: { rows: ImportExportRow[] }) {
  if (!rows || rows.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent import/export activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-4 rounded-md border border-border p-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <Badge variant={row.action === 'EXPORT' ? 'default' : 'warning'}>{row.action}</Badge>
                <span>{row.resourceName ?? '—'}</span>
                <span className="text-xs text-muted-foreground">by {row.userFullName}</span>
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(new Date(row.timestamp))}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
