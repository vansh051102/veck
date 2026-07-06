'use client'

import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api-client'
import { useCurrentUser } from '@/lib/use-current-user'
import { PermissionGate } from '@/components/permission-gate'

interface OrgUser {
  id: string
  fullName: string
  email: string
}

interface Props {
  leadId: string
  assignedToId: string | null
  assignedToName: string | null
  onChanged: () => void
}

export function LeadAssignControl({ leadId, assignedToId, assignedToName, onChanged }: Props) {
  const me = useCurrentUser()
  const [users, setUsers] = useState<OrgUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .get<OrgUser[]>('/users')
      .then((res) => setUsers(res.data ?? []))
      .catch(() => setUsers([]))
  }, [])

  async function assign(userId: string) {
    setSaving(true)
    setError(null)
    try {
      await api.put(`/leads/${leadId}/assign`, { assignedToId: userId })
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign lead')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <PermissionGate permission="leads:assign">
        <select
          value={assignedToId || ''}
          onChange={(e) => e.target.value && assign(e.target.value)}
          disabled={saving}
          aria-label="Assign lead to user"
          className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="" disabled>
            {assignedToName || 'Unassigned'}
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>
        {me && me.id !== assignedToId && (
          <button
            type="button"
            onClick={() => assign(me.id)}
            disabled={saving}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            Assign to me
          </button>
        )}
      </PermissionGate>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
