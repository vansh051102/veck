'use client'

import { useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'
import type { WorkflowStage } from '@/lib/workflow-stages'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const BEHAVIOR_BADGE_VARIANT: Record<string, 'secondary' | 'warning' | 'success'> = {
  Default: 'secondary',
  Quotation: 'warning',
  'Order Execution': 'success',
}

interface StageListProps {
  stages: WorkflowStage[]
  selectedKey: string | null
  onSelect: (key: string) => void
  onReorder: (from: number, to: number) => void
  onMove: (index: number, dir: -1 | 1) => void
}

export function StageList({ stages, selectedKey, onSelect, onReorder, onMove }: StageListProps) {
  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  return (
    <ul className="space-y-1.5">
      {stages.map((s, i) => {
        const active = selectedKey === s.key
        return (
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
              if (dragIndex.current !== null) onReorder(dragIndex.current, i)
              dragIndex.current = null
            }}
            onDragEnd={() => setDragOverIndex(null)}
            className={cn(
              'group flex items-center gap-2 rounded-md border px-2 py-2 transition-colors',
              active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50',
              dragOverIndex === i && 'border-primary'
            )}
          >
            <span className="cursor-grab select-none text-muted-foreground active:cursor-grabbing" title="Drag to reorder" aria-hidden>
              <GripVertical className="h-4 w-4" />
            </span>

            <button
              type="button"
              onClick={() => onSelect(s.key)}
              className="flex flex-1 items-center gap-2 overflow-hidden text-left"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className={cn('truncate text-sm', active ? 'font-medium' : 'font-normal')}>{s.name}</span>
              <Badge variant={BEHAVIOR_BADGE_VARIANT[s.behavior] ?? 'secondary'} className="shrink-0">
                {s.behavior}
              </Badge>
              {s.terminal && (
                <Badge variant="destructive" className="shrink-0">
                  Terminal
                </Badge>
              )}
            </button>

            <span className="hidden shrink-0 flex-col items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:flex">
              <button
                type="button"
                aria-label="Move up"
                disabled={i === 0}
                className="text-xs text-muted-foreground disabled:opacity-30"
                onClick={() => onMove(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={i === stages.length - 1}
                className="text-xs text-muted-foreground disabled:opacity-30"
                onClick={() => onMove(i, 1)}
              >
                ↓
              </button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
