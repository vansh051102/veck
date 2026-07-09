// ============================================================================
// PER-COMPANY MODULE ACCESS
// ============================================================================
// Pure, dependency-free module registry shared by client components (sidebar,
// admin workspace toggles) and server routes. Keys map 1:1 to real route
// groups — the toggle state lives in Organization.moduleAccess JSON.
// A missing/null key means ENABLED (fail-open, back-compat for pre-feature orgs).

export const MODULE_KEYS = [
  'leads',
  'contacts',
  'quotes',
  'purchase_requests',
  'activities',
  'analytics',
  'performance',
] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

export const MODULE_LABELS: Record<ModuleKey, { label: string; description: string }> = {
  leads: {
    label: 'Leads management',
    description: 'Controls the lead pipeline, lead detail workspace, and lead import/export.',
  },
  contacts: {
    label: 'Contacts',
    description: 'Enables the shared contact directory used by lead workflows.',
  },
  quotes: {
    label: 'Quotations management',
    description: 'Controls quotation creation and sending on leads.',
  },
  purchase_requests: {
    label: 'Purchase requests',
    description: 'Enables purchase request workflows for the purchase team.',
  },
  activities: {
    label: 'Activities & logging',
    description: 'Controls call/message/meeting logging and reminders on leads.',
  },
  analytics: {
    label: 'Analytics',
    description: 'Enables the analytics dashboards and reports.',
  },
  performance: {
    label: 'Performance',
    description: 'Enables the team performance tracking pages.',
  },
}

/**
 * True if the module is enabled for the org. `moduleAccess` is the raw
 * Organization.moduleAccess JSON — null/missing keys mean enabled.
 */
export function isModuleEnabled(moduleAccess: unknown, key: ModuleKey): boolean {
  if (!moduleAccess || typeof moduleAccess !== 'object') return true
  const value = (moduleAccess as Record<string, unknown>)[key]
  return value !== false
}
