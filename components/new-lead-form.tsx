'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { toFormErrors } from '@/lib/form-errors'
import { Button } from '@/components/ui/button'
import { LEAD_PRIORITIES } from '@/lib/validation'

interface ContactOption {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
}

export function NewLeadForm({ onCreated }: { onCreated: (leadId: string) => void }) {
  const [mode, setMode] = useState<'existing' | 'new'>('new')

  // Existing-contact search
  const [contactSearch, setContactSearch] = useState('')
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([])
  const [selectedContactId, setSelectedContactId] = useState('')

  // New-contact fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  // Lead fields
  const [companyName, setCompanyName] = useState('')
  const [priority, setPriority] = useState<(typeof LEAD_PRIORITIES)[number]>('Medium')
  const [notes, setNotes] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (mode !== 'existing' || contactSearch.trim().length < 2) {
      setContactOptions([])
      return
    }
    let cancelled = false
    const debounce = setTimeout(async () => {
      try {
        const res = await api.get<ContactOption[]>(`/contacts?search=${encodeURIComponent(contactSearch)}&limit=10`)
        if (!cancelled) setContactOptions(res.data ?? [])
      } catch {
        if (!cancelled) setContactOptions([])
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(debounce)
    }
  }, [mode, contactSearch])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    if (!companyName.trim()) {
      setError('Company name is required')
      return
    }
    if (mode === 'existing' && !selectedContactId) {
      setError('Select a contact')
      return
    }
    if (mode === 'new' && (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim())) {
      setError('First name, last name, email, and phone are required for a new contact')
      return
    }

    setSubmitting(true)
    try {
      let contactId = selectedContactId

      if (mode === 'new') {
        const contactRes = await api.post<{ id: string }>('/contacts', {
          firstName,
          lastName,
          email,
          phone,
        })
        contactId = contactRes.data!.id
      }

      const leadRes = await api.post<{ id: string }>('/leads', {
        contactId,
        companyName,
        priority,
        notes: notes || undefined,
      })

      onCreated(leadRes.data!.id)
    } catch (err) {
      const parsed = toFormErrors(err, 'Failed to create lead')
      setError(parsed.message)
      setFieldErrors(parsed.fields)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === 'new' ? 'default' : 'outline'}
          onClick={() => setMode('new')}
        >
          New Contact
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'existing' ? 'default' : 'outline'}
          onClick={() => setMode('existing')}
        >
          Existing Contact
        </Button>
      </div>

      {mode === 'existing' ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Search contact</label>
          <input
            value={contactSearch}
            onChange={(e) => {
              setContactSearch(e.target.value)
              setSelectedContactId('')
            }}
            placeholder="Name, email, or phone…"
            className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          {contactOptions.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-border">
              {contactOptions.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    setSelectedContactId(c.id)
                    setContactSearch(`${c.firstName} ${c.lastName}`)
                    setContactOptions([])
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {c.firstName} {c.lastName} · {c.email}
                </button>
              ))}
            </div>
          )}
          {selectedContactId && <p className="text-xs text-muted-foreground">Contact selected.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lead-first-name" className="text-sm font-medium">
              First name
            </label>
            <input
              id="lead-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            {fieldErrors.firstName && <p className="text-xs text-destructive">{fieldErrors.firstName}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lead-last-name" className="text-sm font-medium">
              Last name
            </label>
            <input
              id="lead-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            {fieldErrors.lastName && <p className="text-xs text-destructive">{fieldErrors.lastName}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lead-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="lead-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lead-phone" className="text-sm font-medium">
              Phone
            </label>
            <input
              id="lead-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="lead-company" className="text-sm font-medium">
          Company name
        </label>
        <input
          id="lead-company"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        {fieldErrors.companyName && <p className="text-xs text-destructive">{fieldErrors.companyName}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Priority</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as (typeof LEAD_PRIORITIES)[number])}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        >
          {LEAD_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create lead'}
      </Button>
    </form>
  )
}
