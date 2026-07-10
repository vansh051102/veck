// Pure, dependency-free lead-stage data shared by both the server workflow
// engine (lib/workflow.ts) and client components (e.g. the stage-change
// dropdown on the lead detail page). Keeping this isolated from lib/workflow.ts
// (which imports the Prisma client) means client components can import it
// without pulling a Node-only DB client into the browser bundle.

export const TERMINAL_STAGES = ['Order Closed', 'Deal Lost', 'Disqualified'] as const

/** Stages that count as a won / confirmed order (not yet fully closed). */
export const WON_STAGES = ['Order Confirmed'] as const

/** Legacy stage name kept for one-time DB migration / back-compat reads. */
export const LEGACY_CLOSED_WON = 'Closed Won'

export function isTerminalStage(stage: string): boolean {
  return (TERMINAL_STAGES as readonly string[]).includes(stage) || stage === LEGACY_CLOSED_WON
}

export function isWonStage(stage: string): boolean {
  return (WON_STAGES as readonly string[]).includes(stage) || stage === LEGACY_CLOSED_WON
}

export function normalizeStageName(stage: string): string {
  return stage === LEGACY_CLOSED_WON ? 'Order Confirmed' : stage
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
  'No Requirement',
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
  'Purchased Elsewhere',
  'Price Too High',
  'Price Not Accepted',
  'Project Cancelled',
  'Payment Terms Issue',
  'Payment Terms Not Accepted',
  'Delivery Timeline Issue',
  'Delivery Timeline Not Accepted',
  'No Response',
  'Customer Not Responding',
  'Dormant',
  'Requirement Postponed',
  'Budget Issue',
  'Budget Constraints',
  'Credit Requirement',
  'Credit Facility Not Approved',
  'Product Not Suitable',
  'Product Specification Changed',
  'Quantity Reduced / Not Commercially Viable',
  'Customer Purchased Elsewhere',
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

// All workflow stages in display order (Sales Order Management + post-order).
export const ALL_STAGES = [
  'New Lead',
  'Contacted',
  'Qualified',
  'Quote Sent',
  'Order Confirmed',
  'Order Closed',
  'Deal Lost',
  'Disqualified',
] as const

// Stage movement is unrestricted by graph; role gates live in lib/workflow.ts.
// Access itself is role-scoped via canAccessLead() / buildOwnershipFilter().
export function otherStages(currentStage: string): string[] {
  const current = normalizeStageName(currentStage)
  return ALL_STAGES.filter((s) => s !== current)
}

// Returns the stage tab labels a given role should see in the leads list nav.
// Purchase: quote handoff + post-order procurement stages.
// Marketing: top of funnel through Qualified (handover to Sales).
export function visibleStagesForRole(role: string): string[] {
  if (role === 'purchase') {
    return ['Qualified', 'Quote Sent', 'Order Confirmed', 'Order Closed']
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

/** Roles that receive marketing → sales handover at Qualified. */
export const SALES_HANDOVER_ROLES = [
  'sales_manager',
  'sales_executive',
  'sales_purchase',
] as const
