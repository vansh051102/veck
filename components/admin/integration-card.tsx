'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, ApiError } from '@/lib/api-client'

export interface IntegrationField {
  key: string
  label: string
  placeholder?: string
  /** Masked value from the server (e.g. "••••ab12"), or null if unset. */
  maskedValue: string | null
}

interface IntegrationCardProps {
  provider: string
  name: string
  desc: string
  configured: boolean
  fields: IntegrationField[]
  webhookUrl?: string
  onSaved: () => void
}

export function IntegrationCard({ provider, name, desc, configured, fields, webhookUrl, onSaved }: IntegrationCardProps) {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = { provider }
      for (const field of fields) {
        // Only send fields the admin actually typed into — leaves untouched
        // keys alone instead of clobbering them with empty values.
        if (values[field.key] !== undefined) payload[field.key] = values[field.key] || null
      }
      const res = await api.put<{ generatedSecret: string | null }>('/settings/integrations', payload)
      setGeneratedSecret(res.data?.generatedSecret ?? null)
      setValues({})
      setEditing(false)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = { provider }
      for (const field of fields) payload[field.key] = null
      await api.put('/settings/integrations', payload)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not disconnect')
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
            configured ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted'
          }`}
        >
          {configured ? 'Connected' : 'Needs setup'}
        </span>
      </div>

      {webhookUrl && (
        <p className="mt-2 truncate rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">{webhookUrl}</p>
      )}

      {generatedSecret && (
        <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
          <p className="font-medium">Save this secret — shown once:</p>
          <p className="mt-1 break-all font-mono">{generatedSecret}</p>
        </div>
      )}

      {editing ? (
        <div className="mt-3 space-y-2">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="text-xs text-muted-foreground">{field.label}</label>
              <Input
                type="text"
                placeholder={field.maskedValue ?? field.placeholder}
                value={values[field.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                className="mt-1"
              />
            </div>
          ))}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValues({}); setError(null) }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {configured ? 'Edit' : 'Connect'}
          </Button>
          {configured && (
            <Button size="sm" variant="ghost" onClick={handleDisconnect} disabled={saving}>
              Disconnect
            </Button>
          )}
        </div>
      )}
    </li>
  )
}
