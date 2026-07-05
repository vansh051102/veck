'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { toFormErrors } from '@/lib/form-errors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useCurrentUser } from '@/lib/use-current-user'

interface Settings {
  autoAssignmentEnabled: boolean
  slaDefaultHours: number
  slaWarningHours: number
  emailNotificationsEnabled: boolean
}

export default function SettingsPage() {
  const { toast } = useToast()
  const me = useCurrentUser()
  const isAdmin = me?.role === 'admin'

  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<Settings>('/settings')
      .then((res) => setSettings(res.data ?? null))
      .catch((err) => setError(toFormErrors(err, 'Failed to load settings').message))
      .finally(() => setLoading(false))
  }, [])

  async function update(patch: Partial<Settings>) {
    if (!settings) return
    const previous = settings
    setSettings({ ...settings, ...patch })
    try {
      const res = await api.put<Settings>('/settings', patch)
      setSettings(res.data ?? { ...settings, ...patch })
      toast('Settings saved')
    } catch (err) {
      setSettings(previous)
      toast(toFormErrors(err, 'Failed to save settings').message, 'error')
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading settings…</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!settings) return null

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      {!isAdmin && (
        <p className="text-sm text-muted-foreground">
          Settings are read-only for your role. Ask an admin to make changes.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lead assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.autoAssignmentEnabled}
              disabled={!isAdmin}
              onChange={(e) => update({ autoAssignmentEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <span>
              <span className="font-medium">Auto-assign new leads</span>
              <span className="block text-muted-foreground">
                New leads go to the active user with the fewest open leads (capacity-based
                round-robin).
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.emailNotificationsEnabled}
              disabled={!isAdmin}
              onChange={(e) => update({ emailNotificationsEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <span className="font-medium">Email notifications</span>
          </label>
        </CardContent>
      </Card>
    </div>
  )
}
