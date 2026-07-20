import { ValidationError, ConflictError } from './api-response'
import {
  ALL_STAGES,
  TERMINAL_STAGES,
  isTerminalStage,
  isValidReason,
  reasonsForStage,
  normalizeStageName,
  LEGACY_CLOSED_WON,
} from './lead-stages'

export { TERMINAL_STAGES, isTerminalStage }

// Default SLA windows (hours) — overridden when org workflowStages include slaHours
const DEFAULT_SLA_HOURS: Record<string, number | null> = {
  'New Lead': 1,
  Contacted: 24,
  Qualified: 3,
  'Quote Sent': 144,
  'Order Confirmed': 72,
  'Order Closed': null,
  'Deal Lost': null,
  Disqualified: null,
  [LEGACY_CLOSED_WON]: null,
}

// Purchase-owned quote handoff
const PURCHASE_QUOTE_TRANSITIONS = new Set(['Qualified→Quote Sent', 'Quote Sent→Qualified'])

const PURCHASE_ALLOWED_STAGES = new Set([
  'Qualified',
  'Quote Sent',
  'Order Confirmed',
  'Order Closed',
  'Deal Lost',
  'Disqualified',
])

export function isValidTransition(fromStage: string, toStage: string): boolean {
  const from = normalizeStageName(fromStage)
  const to = normalizeStageName(toStage)
  const known = ALL_STAGES as readonly string[]
  if (!known.includes(from) && fromStage !== LEGACY_CLOSED_WON) {
    throw new ValidationError(`Unknown stage: ${fromStage}`)
  }
  if (!known.includes(to)) {
    throw new ValidationError(`Unknown stage: ${toStage}`)
  }
  return from !== to
}

// Sequence is guidance, not a gate. Out-of-sequence moves are permitted for
// every role and recorded instead — see isOutOfSequence in lib/lead-stages.ts
// and the STAGE_CHANGE audit entry written by the stage route.

/**
 * Role-aware transition check.
 * - Purchase: quote handoff + post-order stages; can close from Quote Sent / Order Confirmed
 * - Sales/marketing: cannot Qualified → Quote Sent (purchase owns pricing handoff)
 * - Marketing: cannot enter Quote Sent / Order Confirmed / Order Closed
 */
export function assertRoleCanTransition(role: string, fromStage: string, toStage: string): void {
  const from = normalizeStageName(fromStage)
  const to = normalizeStageName(toStage)
  const key = `${from}→${to}`

  if (role === 'admin') return

  if (role === 'purchase') {
    if (PURCHASE_QUOTE_TRANSITIONS.has(key)) return
    if (from === 'Quote Sent' && ['Order Confirmed', 'Deal Lost', 'Disqualified'].includes(to)) {
      return
    }
    if (from === 'Order Confirmed' && ['Order Closed', 'Deal Lost'].includes(to)) return
    if (from === 'Order Closed' && to === 'Order Confirmed') return // reopen
    if (PURCHASE_ALLOWED_STAGES.has(from) && PURCHASE_ALLOWED_STAGES.has(to) && from !== to) {
      // Allow purchase to move within their visible funnel when needed
      if (
        (from === 'Qualified' || from === 'Quote Sent' || from === 'Order Confirmed') &&
        (to === 'Deal Lost' || to === 'Disqualified')
      ) {
        return
      }
    }
    throw new ValidationError(
      'Purchase can transition Qualified ↔ Quote Sent, confirm orders, close procurement, or mark loss from those stages'
    )
  }

  if (role === 'sales_purchase') return

  if (role.startsWith('marketing')) {
    if (['Quote Sent', 'Order Confirmed', 'Order Closed'].includes(to)) {
      throw new ValidationError(
        'Marketing cannot move leads past Qualified — assign to Sales at Qualified'
      )
    }
  }

  if (
    (role.startsWith('sales') || role.startsWith('marketing')) &&
    from === 'Qualified' &&
    to === 'Quote Sent'
  ) {
    throw new ValidationError('Only Purchase can move a lead from Qualified to Quote Sent')
  }
}

export function assertTransitionAllowed(
  lead: { stage: string },
  toStage: string,
  reason?: string,
  role?: string
): void {
  const fromStage = normalizeStageName(lead.stage)
  const to = normalizeStageName(toStage)

  if (!isValidTransition(fromStage, to)) {
    throw new ConflictError(`Lead is already in stage "${fromStage}"`)
  }

  if (role) {
    assertRoleCanTransition(role, fromStage, to)
  }

  // Out-of-sequence moves are deliberately allowed for every role; the stage
  // route records them with a reason for admin review rather than blocking.

  const isLossPath = to === 'Deal Lost' || to === 'Disqualified'

  if (isLossPath) {
    if (!reason || reason.trim().length === 0) {
      throw new ValidationError(`A reason is required when moving a lead to "${to}"`)
    }
    if (!isValidReason(to, reason)) {
      throw new ValidationError(
        `Invalid reason "${reason}". Valid reasons: ${reasonsForStage(to).join(', ')}`
      )
    }
  }
}

export function calculateSlaDeadline(
  stage: string,
  from: Date = new Date(),
  slaHoursOverride?: number | null
): Date {
  const normalized = normalizeStageName(stage)
  const hours =
    slaHoursOverride !== undefined ? slaHoursOverride : DEFAULT_SLA_HOURS[normalized]
  if (hours === null || hours === undefined) {
    return new Date(from.getTime() + 365 * 24 * 60 * 60 * 1000)
  }
  return new Date(from.getTime() + hours * 60 * 60 * 1000)
}

export function isSlaBreached(slaDeadline: Date, now: Date = new Date()): boolean {
  return now.getTime() > slaDeadline.getTime()
}
