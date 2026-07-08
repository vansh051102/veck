import { ValidationError, ConflictError } from './api-response'
import {
  ALL_STAGES,
  TERMINAL_STAGES,
  isTerminalStage,
  isValidReason,
  reasonsForStage,
} from './lead-stages'

export { TERMINAL_STAGES, isTerminalStage }

// ============================================================================
// LEAD WORKFLOW STATE MACHINE
// ============================================================================
// Stage movement is unrestricted: anyone with access to a lead (see
// canAccessLead in lib/rbac.ts) can move it to any other stage, in any
// order, including reopening a terminal one — there is no required
// sequence and no minimum-activity/checklist gate. The only structural
// requirement left is a valid SOP reason when landing on Deal Lost or
// Disqualified, since that's data capture (loss analytics) rather than
// an access restriction.

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

export function isValidTransition(fromStage: string, toStage: string): boolean {
  if (!(ALL_STAGES as readonly string[]).includes(fromStage)) {
    throw new ValidationError(`Unknown stage: ${fromStage}`)
  }
  if (!(ALL_STAGES as readonly string[]).includes(toStage)) {
    throw new ValidationError(`Unknown stage: ${toStage}`)
  }
  return fromStage !== toStage
}

/**
 * Validates that a stage transition is structurally legal (different,
 * known stages) and that a valid reason is supplied for the loss path.
 * Throws ValidationError / ConflictError if the transition should be blocked.
 */
export function assertTransitionAllowed(
  lead: { stage: string },
  toStage: string,
  reason?: string
): void {
  const fromStage = lead.stage

  if (!isValidTransition(fromStage, toStage)) {
    throw new ConflictError(`Lead is already in stage "${fromStage}"`)
  }

  const isLossPath = toStage === 'Deal Lost' || toStage === 'Disqualified'

  if (isLossPath) {
    if (!reason || reason.trim().length === 0) {
      throw new ValidationError(`A reason is required when moving a lead to "${toStage}"`)
    }
    if (!isValidReason(toStage, reason)) {
      throw new ValidationError(
        `Invalid reason "${reason}". Valid reasons: ${reasonsForStage(toStage).join(', ')}`
      )
    }
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
