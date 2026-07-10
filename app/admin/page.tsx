'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { toFormErrors } from '@/lib/form-errors'

interface OrgCard {
  id: string
  name: string
  industry: string | null
  country: string | null
  memberCount: number
  createdAt: string
}

export default function AdminCompanyPickerPage() {
  const { toast } = useToast()
  const [orgs, setOrgs] = useState<OrgCard[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  function load() {
    setLoading(true)
    api
      .get<OrgCard[]>('/organizations')
      .then((res) => setOrgs(res.data ?? []))
      .catch((err) => toast(toFormErrors(err, 'Failed to load companies').message, 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function createCompany() {
    if (!name.trim()) return
    setCreating(true)
    try {
      await api.post('/organizations', { name: name.trim(), country: 'India' })
      toast('Company created')
      setName('')
      load()
    } catch (err) {
      toast(toFormErrors(err, 'Failed to create company').message, 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-primary">veck</h1>
            <p className="text-xs text-muted-foreground">Admin · All companies</p>
          </div>
          <Link href="/leads" className="text-sm text-accent hover:underline">
            Open leads app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">All companies</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a workspace to manage settings, roles, and lead workflow.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New company name"
              className="crm-input w-56 bg-card"
            />
            <Button onClick={createCompany} disabled={creating || !name.trim()}>
              + New company
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orgs.map((org) => (
              <Link
                key={org.id}
                href={`/admin/workspace/${org.id}/company-details`}
                className="rounded-lg border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-modal"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                  {org.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()}
                </div>
                <h3 className="font-semibold">{org.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {org.industry || '—'} · {org.country || 'India'} · {org.memberCount} members
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
