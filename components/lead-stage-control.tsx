'use client'

import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api-client'
import { otherStages, reasonsForStage, visibleStagesForRole } from '@/lib/lead-stages'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { PermissionGate } from '@/components/permission-gate'
import { useCurrentUser } from '@/lib/use-current-user'

interface Props {
  leadId: string
  currentStage: string
  onChanged: () => void
}

interface OrgUser {
  id: string
  fullName: string
  role: string
}

const SALES_ROLES = ['sales_manager', 'sales_executive', 'sales_purchase']

export function LeadStageControl({ leadId, currentStage, onChanged }: Props) {
  const me = useCurrentUser()
  const [targetStage, setTargetStage] = useState('')
  const [reason, setReason] = useState('')
  const [assignedToId, setAssignedToId] = useState('')
  const [salesUsers, setSalesUsers] = useState<OrgUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Quote Sent popup state
  const [showQuotePopup, setShowQuotePopup] = useState(false)
  const [quoteConfirm, setQuoteConfirm] = useState(false)
  const [supplierMargin, setSupplierMargin] = useState('')
  const [quotationNumber, setQuotationNumber] = useState('')
  const [productCategory, setProductCategory] = useState('')
  const [quotationValue, setQuotationValue] = useState('')
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const visible = me ? visibleStagesForRole(me.role) : otherStages(currentStage)
  const nextOptions = otherStages(currentStage).filter((s) => visible.includes(s))
  const isLossPath = targetStage === 'Deal Lost' || targetStage === 'Disqualified'
  const isHandover = targetStage === 'Qualified'
  const isQuoteSent = targetStage === 'Quote Sent'
  const isMarketing = me?.role.startsWith('marketing') ?? false
  const handoverRequired = isHandover && isMarketing

  useEffect(() => {
    if (!isHandover || salesUsers.length > 0) return
    api
      .get<OrgUser[]>('/users')
      .then((res) =>
        setSalesUsers((res.data ?? []).filter((u) => SALES_ROLES.includes(u.role)))
      )
      .catch(() => setSalesUsers([]))
  }, [isHandover])

  function openQuotePopup() {
    setQuoteError(null)
    setQuoteConfirm(false)
    setSupplierMargin('')
    setQuotationNumber('')
    setProductCategory('')
    setQuotationValue('')
    setShowQuotePopup(true)
  }

  async function submitStageChange() {
    setLoading(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        stage: targetStage,
        reason: reason || undefined,
        assignedToId: (isHandover && assignedToId) || undefined,
      }

      if (isQuoteSent) {
        payload.supplierMargin = Number(supplierMargin)
        payload.quotationNumber = quotationNumber.trim()
        payload.productCategory = productCategory.trim()
        payload.quotationValue = Number(quotationValue)
      }

      await api.put(`/leads/${leadId}/stage`, payload)
      setTargetStage('')
      setReason('')
      setAssignedToId('')
      setShowQuotePopup(false)
      setQuoteConfirm(false)
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to change stage')
    } finally {
      setLoading(false)
    }
  }

  function handleConfirm() {
    if (isQuoteSent && !showQuotePopup) {
      openQuotePopup()
      return
    }
    submitStageChange()
  }

  function handleQuoteSubmit() {
    if (!supplierMargin || !quotationNumber.trim() || !productCategory.trim() || !quotationValue) {
      setQuoteError('All fields are required')
      return
    }
    if (Number(supplierMargin) < 0 || Number(supplierMargin) > 100) {
      setQuoteError('Supplier margin must be between 0 and 100')
      return
    }
    if (Number(quotationValue) <= 0) {
      setQuoteError('Quotation value must be positive')
      return
    }
    if (!quoteConfirm) {
      setQuoteError('Please confirm the details by checking the box')
      return
    }
    setQuoteError(null)
    submitStageChange()
  }

  return (
    <PermissionGate permission="leads:edit">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={targetStage}
            onChange={(e) => setTargetStage(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Move to…</option>
            {nextOptions.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>

          {isLossPath && (
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-label="Loss reason (required)"
              className="h-9 min-w-[200px] rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Reason (required)…</option>
              {reasonsForStage(targetStage).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}

          {isHandover && (
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              aria-label={`Hand over to salesperson${handoverRequired ? ' (required)' : ''}`}
              className="h-9 min-w-[220px] rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">
                {handoverRequired ? 'Hand over to salesperson (required)…' : 'Hand over to (optional)…'}
              </option>
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role.replace('_', ' ')})
                </option>
              ))}
            </select>
          )}

          <Button
            size="sm"
            disabled={
              !targetStage ||
              loading ||
              (isLossPath && !reason) ||
              (handoverRequired && !assignedToId)
            }
            onClick={handleConfirm}
          >
            {loading ? 'Moving…' : 'Confirm'}
          </Button>
        </div>
        {isHandover && salesUsers.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No sales users found — the lead keeps its current assignee.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* Quote Sent Popup */}
      {showQuotePopup && (
        <Modal title="Quote Details" onClose={() => setShowQuotePopup(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Enter the quotation details before moving to Quote Sent. These fields are locked after submission.
            </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Supplier Margin (%) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={supplierMargin}
                onChange={(e) => setSupplierMargin(e.target.value)}
                placeholder="e.g. 15"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Quotation Number <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={quotationNumber}
                onChange={(e) => setQuotationNumber(e.target.value)}
                placeholder="e.g. QT-2026-001"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Product Category <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                placeholder="e.g. Industrial Equipment"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Quotation Value (₹) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={quotationValue}
                onChange={(e) => setQuotationValue(e.target.value)}
                placeholder="e.g. 125000"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={quoteConfirm}
              onChange={(e) => setQuoteConfirm(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            I confirm these details are correct. This action cannot be undone.
          </label>

          {quoteError && <p className="text-sm text-destructive">{quoteError}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowQuotePopup(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={loading} onClick={handleQuoteSubmit}>
              {loading ? 'Moving…' : 'Confirm & Move to Quote Sent'}
            </Button>
          </div>
          </div>
        </Modal>
      )}
    </PermissionGate>
  )
}
