'use client'

import type { WorkflowStage } from '@/lib/workflow-stages'
import { ALLOWED_TRANSITIONS, FLAGGED_DISQUALIFY_FROM, isFlaggedDisqualify } from '@/lib/lead-stages'
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

interface BranchEdge {
  source: WorkflowStage
  flagged: boolean
}

// Which trunk stages actually feed a given terminal stage, per the real SOP
// (lib/lead-stages.ts ALLOWED_TRANSITIONS) rather than a single shared anchor.
// Falls back gracefully for stage names the SOP map doesn't know about (an
// admin-renamed or custom-added stage) so the graph never crashes or drops a
// node — it just can't show a rule that isn't encoded anywhere.
function sourcesFor(terminal: WorkflowStage, trunk: WorkflowStage[]): BranchEdge[] {
  const known = trunk.filter((s) => ALLOWED_TRANSITIONS[s.name]?.includes(terminal.name))
  if (known.length > 0) {
    return known.map((source) => ({ source, flagged: isFlaggedDisqualify(source.name, terminal.name) }))
  }

  // Terminal name isn't a recognized SOP target (custom stage) — connect from
  // whichever trunk stages are themselves unrecognized (custom additions), or
  // if every trunk stage is a known SOP stage, fall back to the last one.
  const unrecognized = trunk.filter((s) => !(s.name in ALLOWED_TRANSITIONS))
  const fallback = unrecognized.length > 0 ? unrecognized : trunk.slice(-1)
  return fallback.map((source) => ({ source, flagged: false }))
}

export function PipelineGraph({ stages, selectedKey, onSelect }: PipelineGraphProps) {
  const trunk = stages.filter((s) => !s.terminal)
  const branches = stages.filter((s) => s.terminal)

  const trunkX = (i: number) => PADDING + i * NODE_SPACING
  const trunkIndex = new Map(trunk.map((s, i) => [s.key, i]))
  const trunkEnd = trunk.length ? trunkX(trunk.length - 1) : PADDING
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

          {branches.map((terminal, bi) =>
            sourcesFor(terminal, trunk).map(({ source, flagged }) => {
              const si = trunkIndex.get(source.key) ?? trunk.length - 1
              const sx = trunkX(si)
              const tx = branchXAt(bi)
              return (
                <path
                  key={`branch-edge-${terminal.key}-${source.key}`}
                  d={`M ${sx} ${TRUNK_Y + NODE_R + 3} Q ${sx} ${(TRUNK_Y + BRANCH_Y) / 2} ${tx} ${BRANCH_Y - NODE_R - 3}`}
                  className={cn('fill-none', flagged ? 'stroke-warning/70' : 'stroke-muted-foreground/40')}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
              )
            })
          )}

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
        Solid = forward pipeline path. Dashed = a real path to a terminal outcome — amber dashed (
        {FLAGGED_DISQUALIFY_FROM.join(', ')} → Disqualified) is flagged for admin review.
      </p>
    </div>
  )
}
