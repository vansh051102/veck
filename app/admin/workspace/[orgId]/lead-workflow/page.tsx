'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { toFormErrors } from '@/lib/form-errors'
import type { WorkflowStage } from '@/lib/workflow-stages'

export default function LeadWorkflowPage() {
  const { toast } = useToast()
  const [stages, setStages] = useState<WorkflowStage[]>([])
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3C82D9')
  const [behavior, setBehavior] = useState('Default')
  const [saving, setSaving] = useState(false)

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
    try {
      const normalized = next.map((s, i) => ({ ...s, order: i + 1 }))
      await api.put('/settings', { workflowStages: { stages: normalized } })
      setStages(normalized)
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
      <h2 className="text-xl font-semibold tracking-tight">Lead Workflow</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Non-terminal stages can jump to any other stage. Terminal stages can only be reset to New
        Lead by permitted users.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {stages.map((s) => (
          <span
            key={s.key}
            className="rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: s.color }}
          >
            {s.name}
          </span>
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
          >
            <option>Default</option>
            <option>Quotation</option>
          </select>
        </label>
        <Button onClick={addStage} disabled={saving}>
          + Add Stage
        </Button>
      </div>

      <ul className="mt-6 space-y-3">
        {stages.map((s, i) => (
          <li key={s.key} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1">
                  <button type="button" className="text-xs text-muted-foreground" onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button type="button" className="text-xs text-muted-foreground" onClick={() => move(i, 1)}>
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
                      ? 'Terminal stage — reopen only by permitted users.'
                      : `Stage ${i + 1} of ${stages.length} in your current lead flow order.`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select
                      className="h-8 rounded border border-border px-2 text-xs"
                      value={s.behavior}
                      onChange={(e) => updateStage(i, { behavior: e.target.value })}
                    >
                      <option>Default</option>
                      <option>Quotation</option>
                    </select>
                    <select
                      className="h-8 rounded border border-border px-2 text-xs"
                      value={s.modal}
                      onChange={(e) => updateStage(i, { modal: e.target.value })}
                    >
                      <option>Default</option>
                      <option>Quote fields</option>
                      <option>Loss reason</option>
                    </select>
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
