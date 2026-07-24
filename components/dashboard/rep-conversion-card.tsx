'use client'

import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RepConversion {
  userId: string
  fullName: string
  wonCount: number
  closedCount: number
  totalAssigned: number
  conversionRate: number | null
}

export function RepConversionCard() {
  const [rows, setRows] = useState<RepConversion[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<RepConversion[]>('/reports/rep-conversion?limit=10')
      .then((res) => {
        if (!cancelled) setRows(res.data ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return null
  if (rows.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rep conversion rate</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows
            .slice()
            .sort((a, b) => (b.conversionRate ?? 0) - (a.conversionRate ?? 0))
            .map((row) => (
              <div
                key={row.userId}
                className="flex items-center justify-between gap-4 rounded-md border border-border p-3 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{row.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {row.wonCount} won / {row.closedCount} closed ({row.totalAssigned} assigned)
                  </span>
                </div>
                <span className="font-medium">{row.conversionRate !== null ? `${row.conversionRate}%` : '—'}</span>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}
