'use client'

import { useState } from 'react'
import { api } from '@/lib/api-client'
import { toFormErrors } from '@/lib/form-errors'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Quote {
  id: string
  quoteNumber: string
  status: string
  finalAmount: string
  validUntil: string
}

interface LineItem {
  productId: string
  quantity: string
  price: string
  discount: string
}

const STATUS_VARIANT: Record<string, 'default' | 'warning' | 'success' | 'destructive'> = {
  draft: 'default',
  sent: 'warning',
  accepted: 'success',
  rejected: 'destructive',
  expired: 'destructive',
}

function emptyLineItem(): LineItem {
  return { productId: '', quantity: '1', price: '', discount: '0' }
}

export function LeadQuotes({
  leadId,
  quotes,
  onChanged,
}: {
  leadId: string
  quotes: Quote[]
  leadStage: string
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [items, setItems] = useState<LineItem[]>([emptyLineItem()])
  const [validUntil, setValidUntil] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Send flow: inline email field per quote (replaces window.prompt)
  const [sendFormId, setSendFormId] = useState<string | null>(null)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [sending, setSending] = useState(false)

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!validUntil) {
      setFieldErrors({ validUntil: 'Valid-until date is required' })
      return
    }
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      await api.post(`/leads/${leadId}/quotes`, {
        items: items.map((i) => ({
          productId: i.productId || 'unspecified',
          quantity: Number(i.quantity),
          price: Number(i.price),
          discount: Number(i.discount) || 0,
        })),
        validUntil: new Date(validUntil).toISOString(),
      })
      setShowForm(false)
      setItems([emptyLineItem()])
      setValidUntil('')
      toast('Quote created')
      onChanged()
    } catch (err) {
      const parsed = toFormErrors(err, 'Failed to create quote')
      setError(parsed.message)
      setFieldErrors(parsed.fields)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSend(e: React.FormEvent, quoteId: string) {
    e.preventDefault()
    if (!recipientEmail) return
    setSending(true)
    setError(null)
    try {
      await api.post(`/quotes/${quoteId}/send`, { recipientEmail })
      setSendFormId(null)
      setRecipientEmail('')
      toast(`Quote sent to ${recipientEmail}`)
      onChanged()
    } catch (err) {
      setError(toFormErrors(err, 'Failed to send quote').message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {quotes.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">No quotes yet.</p>
      )}

      {quotes.map((q) => (
        <div key={q.id} className="rounded-md border border-border p-3 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{q.quoteNumber}</p>
              <p className="text-muted-foreground">
                {formatCurrency(Number(q.finalAmount))} · valid until{' '}
                {formatDate(new Date(q.validUntil))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[q.status] || 'default'}>{q.status}</Badge>
              {q.status === 'draft' && sendFormId !== q.id && (
                <Button size="sm" variant="outline" onClick={() => setSendFormId(q.id)}>
                  Send
                </Button>
              )}
            </div>
          </div>

          {sendFormId === q.id && (
            <form onSubmit={(e) => handleSend(e, q.id)} className="mt-2 flex flex-wrap gap-2">
              <label htmlFor={`send-email-${q.id}`} className="sr-only">
                Recipient email
              </label>
              <input
                id={`send-email-${q.id}`}
                type="email"
                required
                autoFocus
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="recipient@company.com"
                className="h-8 min-w-[220px] flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <Button type="submit" size="sm" disabled={sending || !recipientEmail}>
                {sending ? 'Sending…' : 'Send quote'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setSendFormId(null)
                  setRecipientEmail('')
                }}
              >
                Cancel
              </Button>
            </form>
          )}
        </div>
      ))}

      {showForm ? (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-md border border-border p-3">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-4 gap-2">
              <input
                value={item.productId}
                onChange={(e) => updateItem(index, 'productId', e.target.value)}
                placeholder="Product / SKU"
                aria-label="Product or SKU"
                className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                placeholder="Qty"
                aria-label="Quantity"
                min={1}
                className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="number"
                value={item.price}
                onChange={(e) => updateItem(index, 'price', e.target.value)}
                placeholder="Price"
                aria-label="Price"
                min={0}
                className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="number"
                value={item.discount}
                onChange={(e) => updateItem(index, 'discount', e.target.value)}
                placeholder="Discount"
                aria-label="Discount"
                min={0}
                className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          ))}
          {fieldErrors.items && <p className="text-xs text-destructive">{fieldErrors.items}</p>}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setItems((prev) => [...prev, emptyLineItem()])}
          >
            Add line item
          </Button>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="quote-valid-until" className="text-sm font-medium">
              Valid until
            </label>
            <input
              id="quote-valid-until"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            {fieldErrors.validUntil && (
              <p className="text-xs text-destructive">{fieldErrors.validUntil}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create quote'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
          New quote
        </Button>
      )}
    </div>
  )
}
