// Pure, dependency-free lead-stage data shared by both the server workflow
// engine (lib/workflow.ts) and client components (e.g. the stage-change
// dropdown on the lead detail page). Keeping this isolated from lib/workflow.ts
// (which imports the Prisma client) means client components can import it
// without pulling a Node-only DB client into the browser bundle.

export const TERMINAL_STAGES = ['Closed Won', 'Deal Lost', 'Disqualified'] as const

export const NEXT_STAGES: Record<string, string[]> = {
  'New Lead': ['Contacted', 'Deal Lost', 'Disqualified'],
  Contacted: ['Qualified', 'Deal Lost', 'Disqualified'],
  Qualified: ['Quote Sent', 'Deal Lost', 'Disqualified'],
  'Quote Sent': ['Closed Won', 'Deal Lost', 'Disqualified'],
  'Closed Won': [],
  'Deal Lost': [],
  Disqualified: [],
}

export function isTerminalStage(stage: string): boolean {
  return (TERMINAL_STAGES as readonly string[]).includes(stage)
}

// Controlled vocabulary for Deal Lost / Disqualified reasons (from the SOP).
// Free-text reasons are rejected so loss analytics stay queryable.
export const DEAL_LOST_REASONS = [
  'Purchased Elsewhere',
  'No Requirement',
  'Project Cancelled',
  'Price Not Accepted',
  'Delivery Timeline Not Accepted',
  'Payment Terms Not Accepted',
  'Product Not Suitable',
  'No Response (6+ calls/WhatsApp)',
  'Requirement Postponed',
  'Budget Issue',
  'Credit Requirement Issue',
  'Dormant',
] as const

export function isValidDealLostReason(reason: string): boolean {
  return (DEAL_LOST_REASONS as readonly string[]).includes(reason)
}

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
