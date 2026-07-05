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
