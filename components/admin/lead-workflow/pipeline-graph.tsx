'use client'

import type { WorkflowStage } from '@/lib/workflow-stages'
import { cn } from '@/lib/utils'

const PADDING = 32
const NODE_SPACING = 148
const BRANCH_SPACING = 130
const NODE_R = 9
const TRUNK_Y = 46
const BRANCH_Y = 132
const HEIGHT = 170

interface PipelineGraphProps {
  stages: WorkflowStage[]
  selectedKey: string | null
  onSelect: (key: string) => void
}

export function PipelineGraph({ stages, selectedKey, onSelect }: PipelineGraphProps) {
  const trunk = stages.filter((s) => !s.terminal)
  const branches = stages.filter((s) => s.terminal)

  const trunkX = (i: number) => PADDING + i * NODE_SPACING
  const trunkEnd = trunk.length ? trunkX(trunk.length - 1) : PADDING
  // Anchor branches from the last trunk stage (the actual final step before a lead can exit
  // to a terminal outcome) rather than a geometric midpoint — the midpoint has no relation to
  // the data and coincidentally lines up under whichever stage happens to sit in the middle.
  const anchorX = trunkEnd
  const branchSpanWidth = branches.length ? (branches.length - 1) * BRANCH_SPACING : 0
  const branchStartX = anchorX - branchSpanWidth / 2
  const branchXAt = (i: number) => branchStartX + i * BRANCH_SPACING

  const width = Math.max(trunkEnd + PADDING, branchStartX + branchSpanWidth + PADDING, PADDING * 2 + 100)

  function nodeKeyHandlers(key: string) {
    return {
      role: 'button' as const,
      tabIndex: 0,
      onClick: () => onSelect(key),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(key)
        }
      },
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4" role="img" aria-label="Lead pipeline stage graph">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} style={{ minWidth: width }} className="h-[170px] w-full">
          <defs>
            <marker id="trunk-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" className="fill-muted-foreground" />
            </marker>
          </defs>

          {trunk.slice(0, -1).map((s, i) => (
            <line
              key={`edge-${s.key}`}
              x1={trunkX(i) + NODE_R + 4}
              y1={TRUNK_Y}
              x2={trunkX(i + 1) - NODE_R - 4}
              y2={TRUNK_Y}
              className="stroke-muted-foreground"
              strokeWidth={1.5}
              markerEnd="url(#trunk-arrow)"
            />
          ))}

          {branches.map((s, i) => (
            <path
              key={`branch-edge-${s.key}`}
              d={`M ${anchorX} ${TRUNK_Y + NODE_R + 3} Q ${anchorX} ${(TRUNK_Y + BRANCH_Y) / 2} ${branchXAt(i)} ${BRANCH_Y - NODE_R - 3}`}
              className="fill-none stroke-muted-foreground/40"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          ))}

          {trunk.map((s, i) => (
            <g
              key={s.key}
              transform={`translate(${trunkX(i)}, ${TRUNK_Y})`}
              className="cursor-pointer outline-none"
              {...nodeKeyHandlers(s.key)}
            >
              <title>{s.name}</title>
              {selectedKey === s.key && <circle r={NODE_R + 4} className="fill-none stroke-ring" strokeWidth={2} />}
              <circle r={NODE_R} fill={s.color} />
              <text
                y={NODE_R + 16}
                textAnchor="middle"
                className={cn('fill-foreground text-[11px]', selectedKey === s.key ? 'font-medium' : 'font-normal')}
              >
                {s.name}
              </text>
            </g>
          ))}

          {branches.map((s, i) => (
            <g
              key={s.key}
              transform={`translate(${branchXAt(i)}, ${BRANCH_Y})`}
              className="cursor-pointer outline-none"
              {...nodeKeyHandlers(s.key)}
            >
              <title>{s.name}</title>
              {selectedKey === s.key && <circle r={NODE_R + 4} className="fill-none stroke-ring" strokeWidth={2} />}
              <circle r={NODE_R} fill={s.color} />
              <text
                y={NODE_R + 16}
                textAnchor="middle"
                className={cn('fill-foreground text-[11px]', selectedKey === s.key ? 'font-medium' : 'font-normal')}
              >
                {s.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Solid line = pipeline path · dashed line = terminal outcome, reachable from any stage above.
      </p>
    </div>
  )
}
