'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { formatDateTime } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrentUser } from '@/lib/use-current-user'

interface AuditEntry {
  id: string
  action: string
  resourceType: string
  resourceName: string | null
  timestamp: string
  user: { fullName: string }
}

interface OrgUser {
  id: string
  fullName: string
}

export function RecentActivityCard() {
  const me = useCurrentUser()
  const isAdmin = me?.role === 'admin'

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [users, setUsers] = useState<OrgUser[]>([])
  const [filterUserId, setFilterUserId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAdmin) return
    api
      .get<OrgUser[]>('/users')
      .then((res) => setUsers(res.data ?? []))
      .catch(() => setUsers([]))
  }, [isAdmin])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '20' })
    if (isAdmin && filterUserId) params.set('userId', filterUserId)
    api
      .get<AuditEntry[]>(`/audit-log?${params.toString()}`)
      .then((res) => setEntries(res.data ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [isAdmin, filterUserId])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent Activity</CardTitle>
        {isAdmin && (
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Everyone</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && entries.length === 0 && (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
            <span>
              <span className="font-medium">{entry.user.fullName}</span>{' '}
              {entry.action.toLowerCase().replace('_', ' ')}d {entry.resourceType.toLowerCase()}
              {entry.resourceName ? ` "${entry.resourceName}"` : ''}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDateTime(entry.timestamp)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
