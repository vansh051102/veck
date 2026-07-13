'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { MetricCard } from '@/components/ui/metric-card'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate'
import { cn } from '@/lib/utils'

interface ContactRow {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  alternatePhone: string | null
  designation: string | null
  source: string
  tags: string[]
  createdAt: string
  leads: { id: string; stage: string; assignedTo: { fullName: string } | null }[]
}

interface OrgUser {
  id: string
  fullName: string
}

const SOURCES = ['Website', 'LinkedIn', 'Referral', 'Email', 'Phone', 'Other'] as const
const ASSIGN_TABS = [
  { key: 'all', label: 'All' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'assigned', label: 'Assigned' },
] as const

const inputClass =
  'h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary'

export default function ContactsPage() {
  const { toast } = useToast()
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [assignedFilter, setAssignedFilter] = useState<(typeof ASSIGN_TABS)[number]['key']>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [salespeople, setSalespeople] = useState<OrgUser[]>([])
  const [assigningContact, setAssigningContact] = useState<ContactRow | null>(null)
  const [assignForm, setAssignForm] = useState({ companyName: '', assignedToId: '' })
  const [assignSaving, setAssignSaving] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    designation: '',
    source: 'Phone' as (typeof SOURCES)[number],
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search.trim()) params.set('search', search.trim())
      if (assignedFilter !== 'all') params.set('assigned', assignedFilter)
      const res = await api.get<ContactRow[]>(`/contacts?${params}`)
      setContacts(res.data ?? [])
      setTotal(res.pagination?.total ?? res.data?.length ?? 0)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }, [page, search, assignedFilter])

  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  useEffect(() => {
    api
      .get<OrgUser[]>('/users')
      .then((res) => setSalespeople(res.data ?? []))
      .catch(() => setSalespeople([]))
  }, [])

  function openAssign(contact: ContactRow) {
    setAssigningContact(contact)
    setAssignForm({ companyName: '', assignedToId: '' })
  }

  async function assignToSales(e: React.FormEvent) {
    e.preventDefault()
    if (!assigningContact) return
    setAssignSaving(true)
    try {
      await api.post(`/contacts/${assigningContact.id}/assign-to-sales`, {
        companyName: assignForm.companyName.trim(),
        assignedToId: assignForm.assignedToId,
      })
      toast('Contact assigned — lead created')
      setAssigningContact(null)
      await load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed to assign contact', 'error')
    } finally {
      setAssignSaving(false)
    }
  }

  async function createContact(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/contacts', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        designation: form.designation.trim() || undefined,
        source: form.source,
      })
      toast('Contact created')
      setShowNew(false)
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        designation: '',
        source: 'Phone',
      })
      setPage(1)
      await load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed to create contact', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard label="Contacts" helper="in your workspace" value={total || '—'} />
        <MetricCard
          label="On this page"
          helper="current results"
          value={loading ? '—' : contacts.length}
        />
      </section>

      <section className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
        {ASSIGN_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setPage(1)
              setAssignedFilter(tab.key)
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              assignedFilter === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2.5 shadow-soft">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
            className={cn(inputClass, 'pl-8')}
          />
        </div>
        <PermissionGate permission="contacts:create">
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New contact
          </Button>
        </PermissionGate>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Name</th>
              <th className="px-3 py-2.5 font-medium">Phone</th>
              <th className="px-3 py-2.5 font-medium">Email</th>
              <th className="px-3 py-2.5 font-medium">Source</th>
              <th className="px-3 py-2.5 font-medium">Designation</th>
              <th className="px-3 py-2.5 font-medium">Sales assignment</th>
            </tr>
          </thead>
          <tbody>
            {loading && contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Loading contacts…
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No contacts yet. Add database leads here for marketing outreach.
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-medium">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{c.phone}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.email}</td>
                  <td className="px-3 py-2.5">{c.source}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.designation || '—'}</td>
                  <td className="px-3 py-2.5">
                    {c.leads[0] ? (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        Assigned to {c.leads[0].assignedTo?.fullName ?? 'unassigned rep'} · {c.leads[0].stage}
                      </span>
                    ) : (
                      <PermissionGate permission="contacts:edit">
                        <Button size="sm" variant="outline" onClick={() => openAssign(c)}>
                          Assign to sales
                        </Button>
                      </PermissionGate>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {page}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page * 50 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {showNew && (
        <Modal title="New contact" onClose={() => setShowNew(false)}>
          <form onSubmit={createContact} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                First name
                <input
                  required
                  className={inputClass}
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Last name
                <input
                  required
                  className={inputClass}
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Phone
                <input
                  required
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Email
                <input
                  required
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Designation
                <input
                  className={inputClass}
                  value={form.designation}
                  onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Source
                <select
                  className={inputClass}
                  value={form.source}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, source: e.target.value as (typeof SOURCES)[number] }))
                  }
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowNew(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Saving…' : 'Create contact'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {assigningContact && (
        <Modal
          title={`Assign ${assigningContact.firstName} ${assigningContact.lastName} to sales`}
          onClose={() => setAssigningContact(null)}
        >
          <form onSubmit={assignToSales} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Company name
              <input
                required
                className={inputClass}
                value={assignForm.companyName}
                onChange={(e) => setAssignForm((f) => ({ ...f, companyName: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Salesperson
              <select
                required
                className={inputClass}
                value={assignForm.assignedToId}
                onChange={(e) => setAssignForm((f) => ({ ...f, assignedToId: e.target.value }))}
              >
                <option value="" disabled>
                  Select salesperson
                </option>
                {salespeople.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted-foreground">
              Creates a new lead assigned to this salesperson, with source set to your name. This
              contact stays here, marked as assigned.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setAssigningContact(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={assignSaving}>
                {assignSaving ? 'Assigning…' : 'Assign'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
