'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { toFormErrors } from '@/lib/form-errors'

interface Org {
  id: string
  name: string
  industry: string | null
  domain: string | null
  email: string | null
  phone: string | null
  gstin: string | null
  pan: string | null
  address: string | null
  country: string | null
  currency: string | null
}

const field =
  'h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring'

export default function CompanyDetailsPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const { toast } = useToast()
  const [org, setOrg] = useState<Org | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .get<Org>(`/organizations/${orgId}`)
      .then((res) => setOrg(res.data ?? null))
      .catch((err) => toast(toFormErrors(err, 'Failed to load company').message, 'error'))
  }, [orgId])

  async function save() {
    if (!org) return
    setSaving(true)
    try {
      const res = await api.put<Org>(`/organizations/${orgId}`, org)
      setOrg(res.data ?? org)
      toast('Company details saved')
    } catch (err) {
      toast(toFormErrors(err, 'Save failed').message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!org) return <p className="text-sm text-muted-foreground">Loading…</p>

  function set<K extends keyof Org>(key: K, value: Org[K]) {
    setOrg((o) => (o ? { ...o, [key]: value } : o))
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-semibold tracking-tight">Company Details</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tell us a little about your business. This appears in quotes and emails to leads.
      </p>

      <section className="mt-8 space-y-4">
        <h3 className="text-sm font-semibold">Company identity</h3>
        {(
          [
            ['name', 'Company name'],
            ['industry', 'Industry type'],
            ['domain', 'Company domain'],
            ['email', 'Company email'],
            ['phone', 'Company phone'],
            ['gstin', 'GSTIN'],
            ['pan', 'PAN'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
            <input
              className={field}
              value={org[key] ?? ''}
              onChange={(e) => set(key, e.target.value)}
            />
          </label>
        ))}
      </section>

      <section className="mt-8 space-y-4">
        <h3 className="text-sm font-semibold">Address & currency</h3>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Country</span>
          <input className={field} value={org.country ?? ''} onChange={(e) => set('country', e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Business address</span>
          <textarea
            className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={org.address ?? ''}
            onChange={(e) => set('address', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Currency</span>
          <input className={field} value={org.currency ?? 'INR'} onChange={(e) => set('currency', e.target.value)} />
        </label>
      </section>

      <div className="mt-8">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
