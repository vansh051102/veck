// Pure, dependency-free lead-stage data shared by both the server workflow
// engine (lib/workflow.ts) and client components (e.g. the stage-change
// dropdown on the lead detail page). Keeping this isolated from lib/workflow.ts
// (which imports the Prisma client) means client components can import it
// without pulling a Node-only DB client into the browser bundle.

export const TERMINAL_STAGES = ['Closed Won', 'Deal Lost', 'Disqualified'] as const

export function isTerminalStage(stage: string): boolean {
  return (TERMINAL_STAGES as readonly string[]).includes(stage)
}

// Controlled vocabulary for Deal Lost / Disqualified reasons. Disqualified and
// Deal Lost have distinct lists (a lead is disqualified early — bad fit/contact
// — vs lost late after a real opportunity). Free-text reasons are rejected so
// loss analytics stay queryable; a free-text "details" field captures specifics.

// Reasons for marking a lead DISQUALIFIED (early-funnel drop).
export const DISQUALIFIED_REASONS = [
  'Customer Unresponsive',
  'Wrong Number / Invalid Contact',
  'Customer Not Interested',
  'Product Not Supplied by VECK',
  'Specification Not Available',
  'Quantity Not Commercially Viable',
  'Location Not Serviceable',
  'Price / Budget Mismatch',
  'Payment / Credit Terms Not Acceptable',
  'Delivery Timeline Not Feasible',
  'Non-Genuine / Rate Enquiry',
  'Competitor Enquiry',
  'Customer Purchased Elsewhere',
  'Project Cancelled',
  'Requirement Postponed',
  'Requirement Outside VECK Scope',
  'Material Cannot Be Sourced',
  'Duplicate Lead',
  'Management Decision',
  'Other',
] as const

// Reasons for marking a deal LOST (late-funnel loss after a real opportunity).
export const DEAL_LOST_REASONS = [
  'Customer Purchased Elsewhere',
  'Price Not Accepted',
  'Budget Constraints',
  'Payment Terms Not Accepted',
  'Credit Facility Not Approved',
  'Delivery Timeline Not Accepted',
  'Product Specification Changed',
  'Quantity Reduced / Not Commercially Viable',
  'Requirement Postponed',
  'Project Cancelled',
  'Customer Not Responding',
  'Existing Supplier Retained',
  'Competitor Offered Better Terms',
  'Material Cannot Be Sourced',
  'Production / Supply Constraints',
  'Transportation / Freight Issue',
  'Commercial Terms Not Accepted',
  'Management Decision',
  'Customer Withdrew Enquiry',
  'Other',
] as const

// Returns the controlled reason list for a terminal (loss) stage, or [] for
// any non-loss stage.
export function reasonsForStage(stage: string): readonly string[] {
  if (stage === 'Disqualified') return DISQUALIFIED_REASONS
  if (stage === 'Deal Lost') return DEAL_LOST_REASONS
  return []
}

// True if `reason` is valid for moving a lead to the given loss stage.
export function isValidReason(stage: string, reason: string): boolean {
  return reasonsForStage(stage).includes(reason)
}

// Back-compat: accepts a reason valid for either loss stage.
export function isValidDealLostReason(reason: string): boolean {
  return (
    (DEAL_LOST_REASONS as readonly string[]).includes(reason) ||
    (DISQUALIFIED_REASONS as readonly string[]).includes(reason)
  )
}

// Call outcomes for the "Log a Call" action. Only "Connected" counts as the
// customer picking up; everything else maps to contactOutcome="not_received".
export const CALL_OUTCOMES = [
  'Connected',
  'No Answer',
  'Busy',
  'Switched Off',
  'Not Reachable',
  'Wrong Number',
  'Call Back Requested',
] as const

// Maps a call outcome to the lead.contactOutcome value that drives the
// marketing Connected / Not Received tabs.
export function contactOutcomeForCall(outcome: string): 'connected' | 'not_received' {
  return outcome === 'Connected' ? 'connected' : 'not_received'
}

// Channels for the "Log a Message" action.
export const MESSAGE_CHANNELS = ['WhatsApp', 'SMS', 'Email'] as const

// All 7 workflow stages in display order.
export const ALL_STAGES = [
  'New Lead',
  'Contacted',
  'Qualified',
  'Quote Sent',
  'Closed Won',
  'Deal Lost',
  'Disqualified',
] as const

// ============================================================================
// WORKFLOW STAGE CONFIG (Settings.workflowStages)
// ============================================================================
// v1 shape (written by signup/settings): { stages: string[] }
// v2 shape (written by the admin workspace stage editor):
//   { version: 2, stages: WorkflowStage[] }
// normalizeWorkflowStages() accepts either (or null/garbage) and returns the
// rich v2 array, so readers never care which version is stored.

export type StageBehavior = 'standard' | 'requires_reason' | 'requires_quote_details'
export type StageModal = null | 'reason' | 'quote_details'

export interface WorkflowStage {
  id: string
  name: string
  color: string
  order: number
  isTerminal: boolean
  behavior: StageBehavior
  modal: StageModal
}

// Fixed palette for v1 stages / newly added stages without an explicit color.
export const STAGE_COLOR_PALETTE = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#f59e0b', // amber
  '#22c55e', // green
  '#ef4444', // red
  '#6b7280', // gray
] as const

function slugifyStageId(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function inferBehavior(name: string): { behavior: StageBehavior; modal: StageModal } {
  if (name === 'Deal Lost' || name === 'Disqualified') {
    return { behavior: 'requires_reason', modal: 'reason' }
  }
  if (name === 'Quote Sent') {
    return { behavior: 'requires_quote_details', modal: 'quote_details' }
  }
  return { behavior: 'standard', modal: null }
}

/**
 * Normalize any stored Settings.workflowStages value (v1 string array, v2 rich
 * array, null, or garbage) into a rich WorkflowStage[] ordered by `order`.
 * Falls back to ALL_STAGES defaults when nothing usable is stored.
 */
export function normalizeWorkflowStages(json: unknown): WorkflowStage[] {
  const raw =
    json && typeof json === 'object' && Array.isArray((json as { stages?: unknown }).stages)
      ? ((json as { stages: unknown[] }).stages)
      : null

  const source: unknown[] = raw && raw.length > 0 ? raw : [...ALL_STAGES]

  const seen = new Set<string>()
  const stages: WorkflowStage[] = []

  for (const entry of source) {
    // v1 entry: plain stage name
    if (typeof entry === 'string') {
      const name = entry.trim()
      if (!name) continue
      const id = slugifyStageId(name)
      if (!id || seen.has(id)) continue
      seen.add(id)
      stages.push({
        id,
        name,
        color: STAGE_COLOR_PALETTE[stages.length % STAGE_COLOR_PALETTE.length],
        order: stages.length,
        isTerminal: isTerminalStage(name),
        ...inferBehavior(name),
      })
      continue
    }

    // v2 entry: rich object
    if (entry && typeof entry === 'object') {
      const obj = entry as Partial<WorkflowStage> & { name?: unknown }
      const name = typeof obj.name === 'string' ? obj.name.trim() : ''
      if (!name) continue
      const id =
        typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : slugifyStageId(name)
      if (!id || seen.has(id)) continue
      seen.add(id)
      const inferred = inferBehavior(name)
      stages.push({
        id,
        name,
        color:
          typeof obj.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(obj.color)
            ? obj.color
            : STAGE_COLOR_PALETTE[stages.length % STAGE_COLOR_PALETTE.length],
        order: typeof obj.order === 'number' ? obj.order : stages.length,
        isTerminal: typeof obj.isTerminal === 'boolean' ? obj.isTerminal : isTerminalStage(name),
        behavior:
          obj.behavior === 'standard' ||
          obj.behavior === 'requires_reason' ||
          obj.behavior === 'requires_quote_details'
            ? obj.behavior
            : inferred.behavior,
        modal:
          obj.modal === null || obj.modal === 'reason' || obj.modal === 'quote_details'
            ? obj.modal
            : inferred.modal,
      })
    }
  }

  // Guarantee non-empty output even for fully-garbage input
  if (stages.length === 0) {
    return normalizeWorkflowStages(null)
  }

  return stages.sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i }))
}

// Stage movement is unrestricted: anyone with access to a lead can move it
// to any other stage. Access itself is role-scoped via canAccessLead() /
// buildOwnershipFilter() — Purchase can only reach leads assigned to them
// in Qualified or Quote Sent, which naturally limits what they can transition.
export function otherStages(currentStage: string): string[] {
  return ALL_STAGES.filter((s) => s !== currentStage)
}

// Returns the stage tab labels a given role should see in the leads list nav.
// Purchase staff only handle the Qualified → Quote Sent part of the funnel.
// Marketing works the top of the funnel and stops at Qualified (handover point).
export function visibleStagesForRole(role: string): string[] {
  if (role === 'purchase') {
    return ['Qualified', 'Quote Sent']
  }
  if (role.startsWith('marketing')) {
    return ['New Lead', 'Contacted', 'Qualified', 'Disqualified']
  }
  return [...ALL_STAGES]
}

// ============================================================================
// LEAD LIST TABS (role-aware)
// ============================================================================
// A tab is a saved filter: a stage plus (optionally) a contact outcome.
// Marketing splits "Contacted" into "Connected" (call picked up) and
// "Not Received" (no answer yet) — driven by Lead.contactOutcome, which is
// set automatically from logged call outcomes.

export interface LeadTab {
  label: string
  stage?: string // undefined = All
  contactOutcome?: 'connected' | 'not_received'
}

export function leadTabsForRole(role: string): LeadTab[] {
  if (role.startsWith('marketing')) {
    return [
      { label: 'All' },
      { label: 'New Lead', stage: 'New Lead' },
      { label: 'Connected', stage: 'Contacted', contactOutcome: 'connected' },
      { label: 'Not Received', stage: 'Contacted', contactOutcome: 'not_received' },
      { label: 'Qualified', stage: 'Qualified' },
      { label: 'Disqualified', stage: 'Disqualified' },
    ]
  }
  return [{ label: 'All' }, ...visibleStagesForRole(role).map((s) => ({ label: s, stage: s }))]
}
