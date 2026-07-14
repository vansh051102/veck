'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { WorkflowStage } from '@/lib/workflow-stages'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { BEHAVIOR_OPTIONS, FORM_OPTIONS } from './constants'
import { cn } from '@/lib/utils'

interface StageDetailPanelProps {
  stage: WorkflowStage | null
  draftMode: boolean
  stepInfo: { index: number; total: number } | null
  saving: boolean
  onClose: () => void
  onUpdate: (patch: Partial<WorkflowStage>) => void
  onDelete: () => void
  onCreate: (data: { name: string; color: string; behavior: string }) => void
}

export function StageDetailPanel({
  stage,
  draftMode,
  stepInfo,
  saving,
  onClose,
  onUpdate,
  onDelete,
  onCreate,
}: StageDetailPanelProps) {
  const open = draftMode || stage !== null

  const [draftName, setDraftName] = useState('')
  const [draftColor, setDraftColor] = useState('#3C82D9')
  const [draftBehavior, setDraftBehavior] = useState('Default')
  const [slaDraft, setSlaDraft] = useState('')

  useEffect(() => {
    if (draftMode) {
      setDraftName('')
      setDraftColor('#3C82D9')
      setDraftBehavior('Default')
    }
  }, [draftMode])

  useEffect(() => {
    setSlaDraft(stage?.slaHours != null ? String(stage.slaHours) : '')
  }, [stage?.key, stage?.slaHours])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) {
    return (
      <div className="hidden rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground lg:block">
        Select a stage from the list, or add a new one, to see its settings here.
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={draftMode ? 'New stage' : stage?.name}
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full max-w-sm overflow-y-auto border-l border-border bg-card p-4 shadow-modal animate-slide-in-right',
          'lg:static lg:z-auto lg:w-auto lg:max-w-none lg:animate-none lg:rounded-lg lg:border lg:shadow-none'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{draftMode ? 'New stage' : stage?.name}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {draftMode ? (
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!draftName.trim()) return
              onCreate({ name: draftName.trim(), color: draftColor, behavior: draftBehavior })
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Stage name</span>
              <input
                autoFocus
                className="crm-input w-full"
                placeholder="e.g. Proforma Invoice Sent"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Color</span>
              <input
                type="color"
                value={draftColor}
                onChange={(e) => setDraftColor(e.target.value)}
                className="h-9 w-16"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Behavior</span>
              <Select value={draftBehavior} onValueChange={setDraftBehavior}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BEHAVIOR_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {BEHAVIOR_OPTIONS.find((o) => o.value === draftBehavior)?.hint}
              </p>
            </label>
            <Button type="submit" disabled={!draftName.trim() || saving} className="w-full">
              Create stage
            </Button>
          </form>
        ) : stage ? (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              {stage.terminal
                ? 'Terminal stage — can only transition back to New Lead, by permitted users.'
                : stepInfo
                  ? `Can move to any other stage. Currently step ${stepInfo.index} of ${stepInfo.total}.`
                  : 'Can move to any other stage.'}
            </p>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Behavior</span>
              <Select value={stage.behavior} onValueChange={(v) => onUpdate({ behavior: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BEHAVIOR_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {BEHAVIOR_OPTIONS.find((o) => o.value === stage.behavior)?.hint}
              </p>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Form shown</span>
              <Select value={stage.modal} onValueChange={(v) => onUpdate({ modal: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {FORM_OPTIONS.find((o) => o.value === stage.modal)?.hint}
              </p>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">SLA (hours)</span>
              <input
                type="number"
                min={0}
                className="crm-input w-full"
                placeholder="No SLA"
                value={slaDraft}
                onChange={(e) => setSlaDraft(e.target.value)}
                onBlur={() => {
                  const n = slaDraft.trim() === '' ? null : Number(slaDraft)
                  if (n !== stage.slaHours) onUpdate({ slaHours: Number.isFinite(n as number) ? n : null })
                }}
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={stage.terminal}
                onChange={(e) => onUpdate({ terminal: e.target.checked })}
              />
              Terminal stage
            </label>

            <div className="border-t border-border pt-4">
              <Button variant="destructive" size="sm" onClick={onDelete}>
                Delete stage
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
