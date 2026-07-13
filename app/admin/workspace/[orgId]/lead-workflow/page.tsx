'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { toFormErrors } from '@/lib/form-errors'
import type { WorkflowStage } from '@/lib/workflow-stages'

const BEHAVIOR_OPTIONS: { value: string; hint: string }[] = [
  { value: 'Default', hint: 'No extra action when a lead enters this stage.' },
  { value: 'Quotation', hint: 'Generates/attaches a quote document for the lead.' },
  { value: 'Order Execution', hint: 'Starts order fulfillment tracking for the lead.' },
]

const FORM_OPTIONS: { value: string; hint: string }[] = [
  { value: 'Default', hint: 'No extra fields required to enter this stage.' },
  { value: 'Quote fields', hint: 'Asks for quote amount/items before saving.' },
  { value: 'Loss reason', hint: 'Requires a reason before marking the lead lost.' },
]

export default function LeadWorkflowPage() {
  const { toast } = useToast()
  const [stages, setStages] = useState<WorkflowStage[]>([])
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3C82D9')
  const [behavior, setBehavior] = useState('Default')
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')
  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function load() {
    api
      .get<{ workflowStages: { stages: WorkflowStage[] } }>('/settings')
      .then((res) => setStages(res.data?.workflowStages?.stages ?? []))
      .catch((err) => toast(toFormErrors(err, 'Failed to load workflow').message, 'error'))
  }

  useEffect(() => {
    load()
  }, [])

  async function persist(next: WorkflowStage[]) {
    setSaving(true)
    setSaveState('idle')
    try {
      const normalized = next.map((s, i) => ({ ...s, order: i + 1 }))
      await api.put('/settings', { workflowStages: { stages: normalized } })
      setStages(normalized)
      setSaveState('saved')
      toast('Workflow saved')
    } catch (err) {
      toast(toFormErrors(err, 'Failed to save').message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function addStage() {
    if (!name.trim()) return
    const key = name.trim().toLowerCase().replace(/\s+/g, '_')
    if (stages.some((s) => s.key === key || s.name === name.trim())) {
      toast('Stage already exists', 'error')
      return
    }
    persist([
      ...stages,
      {
        key,
        name: name.trim(),
        color,
        order: stages.length + 1,
        terminal: false,
        behavior,
        modal: 'Default',
        slaHours: 24,
      },
    ])
    setName('')
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...stages]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    persist(next)
  }

  function reorder(from: number, to: number) {
    if (from === to) return
    const next = [...stages]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    persist(next)
  }

  function updateStage(index: number, patch: Partial<WorkflowStage>) {
    const next = stages.map((s, i) => (i === index ? { ...s, ...patch } : s))
    persist(next)
  }

  async function removeStage(index: number) {
    const stage = stages[index]
    try {
      const res = await api.get<{ data?: unknown[]; pagination?: { total: number } }>(
        `/leads?stage=${encodeURIComponent(stage.name)}&limit=1`
      )
      const total = (res as { pagination?: { total: number } }).pagination?.total ?? 0
      if (total > 0) {
        toast(`Cannot delete: ${total} lead(s) still in "${stage.name}"`, 'error')
        return
      }
    } catch {
      // if check fails, still allow delete attempt for empty orgs
    }
    persist(stages.filter((_, i) => i !== index))
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Lead Workflow</h2>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saving ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Stages below drive both the lead pipeline and the sales stages (Quote Sent, Order
        Confirmed, Order Closed). Non-terminal stages can jump to any other stage. Terminal stages
        can only be reset to New Lead by permitted users.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-1.5" aria-label="Pipeline preview">
        {stages.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className="rounded-full px-3 py-1 text-xs font-medium text-white"
              style={{ backgroundColor: s.color }}
            >
              {s.name}
            </span>
            {i < stages.length - 1 && <span className="text-muted-foreground">→</span>}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-4">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Stage name</span>
          <input
            className="h-9 w-full rounded-md border border-border px-3 text-sm"
            placeholder="e.g. Proforma Invoice Sent"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Color</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-14" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Behavior</span>
          <select
            className="h-9 rounded-md border border-border px-2 text-sm"
            value={behavior}
            onChange={(e) => setBehavior(e.target.value)}
            title={BEHAVIOR_OPTIONS.find((o) => o.value === behavior)?.hint}
          >
            {BEHAVIOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={addStage} disabled={saving}>
          + Add Stage
        </Button>
      </div>

      <ul className="mt-6 space-y-3">
        {stages.map((s, i) => (
          <li
            key={s.key}
            draggable
            onDragStart={() => {
              dragIndex.current = i
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverIndex(i)
            }}
            onDragLeave={() => setDragOverIndex((cur) => (cur === i ? null : cur))}
            onDrop={(e) => {
              e.preventDefault()
              setDragOverIndex(null)
              if (dragIndex.current !== null) reorder(dragIndex.current, i)
              dragIndex.current = null
            }}
            onDragEnd={() => setDragOverIndex(null)}
            className={`rounded-lg border bg-card p-4 transition-colors ${
              dragOverIndex === i ? 'border-primary' : 'border-border'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 pt-1">
                  <span
                    className="cursor-grab select-none text-sm text-muted-foreground active:cursor-grabbing"
                    title="Drag to reorder"
                    aria-hidden
                  >
                    ⠿
                  </span>
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={i === 0}
                    className="text-xs text-muted-foreground disabled:opacity-30"
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={i === stages.length - 1}
                    className="text-xs text-muted-foreground disabled:opacity-30"
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="font-semibold">{s.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Step {i + 1}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{s.behavior}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.terminal
                      ? 'Terminal stage — can only transition back to New Lead, by permitted users.'
                      : `Can move to any other stage. Currently step ${i + 1} of ${stages.length}.`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-medium text-muted-foreground">Behavior</span>
                      <select
                        className="h-8 rounded border border-border px-2 text-xs"
                        value={s.behavior}
                        onChange={(e) => updateStage(i, { behavior: e.target.value })}
                        title={BEHAVIOR_OPTIONS.find((o) => o.value === s.behavior)?.hint}
                      >
                        {BEHAVIOR_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-medium text-muted-foreground">Form shown</span>
                      <select
                        className="h-8 rounded border border-border px-2 text-xs"
                        value={s.modal}
                        onChange={(e) => updateStage(i, { modal: e.target.value })}
                        title={FORM_OPTIONS.find((o) => o.value === s.modal)?.hint}
                      >
                        {FORM_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.value}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={s.terminal}
                    onChange={(e) => updateStage(i, { terminal: e.target.checked })}
                  />
                  Terminal stage
                </label>
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => removeStage(i)}
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
