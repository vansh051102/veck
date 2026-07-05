import { prisma } from './db'
import { ValidationError, ConflictError } from './api-response'
import {
  NEXT_STAGES,
  TERMINAL_STAGES,
  isTerminalStage,
  isValidDealLostReason,
  DEAL_LOST_REASONS,
} from './lead-stages'
import type { Lead } from '@prisma/client'

export { TERMINAL_STAGES, isTerminalStage }

// ============================================================================
// LEAD WORKFLOW STATE MACHINE
// ============================================================================
// Stages: New Lead -> Contacted -> Qualified -> Quote Sent -> Closed Won
// Any active stage can also move to Deal Lost or Disqualified (terminal).
//
// Trade-off: gating rules below check ALL of a lead's incomplete *required*
// checklists rather than checklists scoped to a specific stage, because the
// Checklist model has no `stage` field yet. This is simple and correct for
// Phase 1 (checklists are created per-stage by convention, so "any required
// checklist incomplete" effectively means "this stage's checklist isn't
// done"), but if multiple stages ever have concurrent required checklists,
// add a `stage` column to Checklist and scope the query to it.

// SLA windows applied to the *new* stage the lead is entering.
const SLA_WINDOW_MS: Record<string, number | null> = {
  'New Lead': 60 * 60 * 1000, // 1 hour
  Contacted: 24 * 60 * 60 * 1000, // 24 hours
  Qualified: 3 * 60 * 60 * 1000, // 3 hours
  'Quote Sent': 6 * 24 * 60 * 60 * 1000, // 6 days
  'Closed Won': null,
  'Deal Lost': null,
  Disqualified: null,
}

const MIN_ACTIVITIES_FOR_TRANSITION: Record<string, number> = {
  'New Lead': 1, // moving out of New Lead requires at least 1 contact attempt
  Contacted: 3, // moving out of Contacted requires at least 3 activities total
}

export function isValidTransition(fromStage: string, toStage: string): boolean {
  if (fromStage === toStage) return false
  const allowed = NEXT_STAGES[fromStage]
  if (!allowed) throw new ValidationError(`Unknown stage: ${fromStage}`)
  return allowed.includes(toStage)
}

/**
 * Validates that a stage transition is structurally legal and that all
 * gating conditions (activity minimums, required checklists) are met.
 * Throws ValidationError / ConflictError if the transition should be blocked.
 */
export async function assertTransitionAllowed(
  lead: Lead,
  toStage: string,
  reason?: string
): Promise<void> {
  const fromStage = lead.stage

  if (!isValidTransition(fromStage, toStage)) {
    throw new ConflictError(
      `Cannot move lead from "${fromStage}" to "${toStage}". Allowed next stages: ${
        NEXT_STAGES[fromStage]?.join(', ') || 'none (terminal stage)'
      }`
    )
  }

  const isLossPath = toStage === 'Deal Lost' || toStage === 'Disqualified'

  if (isLossPath) {
    if (!reason || reason.trim().length === 0) {
      throw new ValidationError(`A reason is required when moving a lead to "${toStage}"`)
    }
    if (!isValidDealLostReason(reason)) {
      throw new ValidationError(
        `Invalid reason "${reason}". Valid reasons: ${DEAL_LOST_REASONS.join(', ')}`
      )
    }
    return // no other gating on the loss path
  }

  // Activity-count gating (checked against the stage being LEFT)
  const minActivities = MIN_ACTIVITIES_FOR_TRANSITION[fromStage]
  if (minActivities) {
    const activityCount = await prisma.activity.count({ where: { leadId: lead.id } })
    if (activityCount < minActivities) {
      throw new ConflictError(
        `Cannot leave stage "${fromStage}": requires at least ${minActivities} logged activit${
          minActivities === 1 ? 'y' : 'ies'
        } (found ${activityCount})`
      )
    }
  }

  // Required-checklist gating
  const incompleteRequired = await prisma.checklist.count({
    where: { leadId: lead.id, isRequired: true, completedAt: null },
  })
  if (incompleteRequired > 0) {
    throw new ConflictError(
      `Cannot leave stage "${fromStage}": ${incompleteRequired} required checklist(s) are still incomplete`
    )
  }
}

export function calculateSlaDeadline(stage: string, from: Date = new Date()): Date {
  const windowMs = SLA_WINDOW_MS[stage]
  // Terminal / unrecognized stages get a far-future deadline so they never breach.
  if (windowMs === null || windowMs === undefined) {
    return new Date(from.getTime() + 365 * 24 * 60 * 60 * 1000)
  }
  return new Date(from.getTime() + windowMs)
}

export function isSlaBreached(slaDeadline: Date, now: Date = new Date()): boolean {
  return now.getTime() > slaDeadline.getTime()
}
