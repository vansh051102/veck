'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { toFormErrors } from '@/lib/form-errors'
import type { WorkflowStage } from '@/lib/workflow-stages'

interface Template {
  id: string
  name: string
  stageKey: string | null
}

export default function StageMappingPage() {
  const { toast } = useToast()
  const [stages, setStages] = useState<WorkflowStage[]>([])
  const [templates, setTemplates] = useState<Template[]>([])

  useEffect(() => {
    api.get<{ workflowStages: { stages: WorkflowStage[] } }>('/settings').then((res) => {
      setStages(res.data?.workflowStages?.stages ?? [])
    })
    api.get<Template[]>('/templates').then((res) => setTemplates(res.data ?? []))
  }, [])

  async function mapTemplate(id: string, stageKey: string | null) {
    try {
      await api.put(`/templates/${id}`, { stageKey })
      setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, stageKey } : t)))
      toast('Mapping saved')
    } catch (err) {
      toast(toFormErrors(err, 'Failed').message, 'error')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-semibold tracking-tight">Stage Mapping</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Map message templates to workflow stages.
      </p>
      <ul className="mt-6 space-y-3">
        {templates.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
            <span className="font-medium">{t.name}</span>
            <select
              className="h-9 rounded-md border border-border px-2 text-sm"
              value={t.stageKey ?? ''}
              onChange={(e) => mapTemplate(t.id, e.target.value || null)}
            >
              <option value="">No stage</option>
              {stages.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </li>
        ))}
        {templates.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Create templates in Template Library first.
          </p>
        )}
      </ul>
      {templates.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Changes save immediately. <Button variant="ghost" className="h-auto p-0 text-xs" disabled>Done</Button>
        </p>
      )}
    </div>
  )
}
