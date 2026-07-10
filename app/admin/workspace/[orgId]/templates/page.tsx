'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { toFormErrors } from '@/lib/form-errors'
import { Modal } from '@/components/ui/modal'

interface Template {
  id: string
  name: string
  channel: string
  body: string
  stageKey: string | null
  isActive: boolean
}

export default function TemplatesPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<Template[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', channel: 'whatsapp', body: '', stageKey: '' })

  function load() {
    api
      .get<Template[]>('/templates')
      .then((res) => setItems(res.data ?? []))
      .catch((err) => toast(toFormErrors(err, 'Failed to load templates').message, 'error'))
  }

  useEffect(() => {
    load()
  }, [])

  async function create() {
    try {
      await api.post('/templates', {
        ...form,
        stageKey: form.stageKey || null,
      })
      toast('Template created')
      setOpen(false)
      setForm({ name: '', channel: 'whatsapp', body: '', stageKey: '' })
      load()
    } catch (err) {
      toast(toFormErrors(err, 'Failed').message, 'error')
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/templates/${id}`)
      toast('Deleted')
      load()
    } catch (err) {
      toast(toFormErrors(err, 'Failed').message, 'error')
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Template Library</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Message templates for WhatsApp, email, and SMS. Sending integrations come later.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>+ New template</Button>
      </div>

      <ul className="mt-6 space-y-3">
        {items.map((t) => (
          <li key={t.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.channel}
                  {t.stageKey ? ` · ${t.stageKey}` : ''}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{t.body}</p>
              </div>
              <button type="button" className="text-xs text-destructive" onClick={() => remove(t.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">No templates yet.</p>
        )}
      </ul>

      <Modal open={open} onClose={() => setOpen(false)} title="New template">
        <div className="space-y-3">
          <input
            className="h-9 w-full rounded-md border border-border px-3 text-sm"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="h-9 w-full rounded-md border border-border px-3 text-sm"
            value={form.channel}
            onChange={(e) => setForm({ ...form, channel: e.target.value })}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
          <input
            className="h-9 w-full rounded-md border border-border px-3 text-sm"
            placeholder="Stage key (optional)"
            value={form.stageKey}
            onChange={(e) => setForm({ ...form, stageKey: e.target.value })}
          />
          <textarea
            className="min-h-[120px] w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder="Message body"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <Button onClick={create}>Create</Button>
        </div>
      </Modal>
    </div>
  )
}
