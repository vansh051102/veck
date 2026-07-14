'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { toFormErrors } from '@/lib/form-errors'
import type { WorkflowStage } from '@/lib/workflow-stages'
import { PipelineGraph } from '@/components/admin/lead-workflow/pipeline-graph'
import { StageList } from '@/components/admin/lead-workflow/stage-list'
import { StageDetailPanel } from '@/components/admin/lead-workflow/stage-detail-panel'

export default function LeadWorkflowPage() {
  const { toast } = useToast()
  const [stages, setStages] = useState<WorkflowStage[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [draftMode, setDraftMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')

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
      return normalized
    } catch (err) {
      toast(toFormErrors(err, 'Failed to save').message, 'error')
      return null
    } finally {
      setSaving(false)
    }
  }

  function addStage(data: { name: string; color: string; behavior: string }) {
    const key = data.name.trim().toLowerCase().replace(/\s+/g, '_')
    if (stages.some((s) => s.key === key || s.name === data.name.trim())) {
      toast('Stage already exists', 'error')
      return
    }
    persist([
      ...stages,
      {
        key,
        name: data.name.trim(),
        color: data.color,
        order: stages.length + 1,
        terminal: false,
        behavior: data.behavior,
        modal: 'Default',
        slaHours: 24,
      },
    ]).then((saved) => {
      if (saved) {
        setDraftMode(false)
        setSelectedKey(key)
      }
    })
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

  function updateStage(key: string, patch: Partial<WorkflowStage>) {
    const next = stages.map((s) => (s.key === key ? { ...s, ...patch } : s))
    persist(next)
  }

  async function removeStage(key: string) {
    const stage = stages.find((s) => s.key === key)
    if (!stage) return
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
    const saved = await persist(stages.filter((s) => s.key !== key))
    if (saved) setSelectedKey(null)
  }

  const selectedIndex = selectedKey ? stages.findIndex((s) => s.key === selectedKey) : -1
  const selectedStage = selectedIndex >= 0 ? stages[selectedIndex] : null
  const stepInfo = selectedIndex >= 0 ? { index: selectedIndex + 1, total: stages.length } : null

  return (
    <div className="mx-auto max-w-5xl">
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

      <div className="mt-6">
        <PipelineGraph stages={stages} selectedKey={selectedKey} onSelect={setSelectedKey} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">Stages</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedKey(null)
                setDraftMode(true)
              }}
            >
              + Add stage
            </Button>
          </div>
          <StageList
            stages={stages}
            selectedKey={selectedKey}
            onSelect={(key) => {
              setDraftMode(false)
              setSelectedKey(key)
            }}
            onReorder={reorder}
            onMove={move}
          />
        </div>

        <StageDetailPanel
          stage={selectedStage}
          draftMode={draftMode}
          stepInfo={stepInfo}
          saving={saving}
          onClose={() => {
            setDraftMode(false)
            setSelectedKey(null)
          }}
          onUpdate={(patch) => selectedKey && updateStage(selectedKey, patch)}
          onDelete={() => selectedKey && removeStage(selectedKey)}
          onCreate={addStage}
        />
      </div>
    </div>
  )
}
