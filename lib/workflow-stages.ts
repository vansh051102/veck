import { prisma } from './db'
import { LEAD_STAGES } from './validation'
import { LEGACY_CLOSED_WON } from './lead-stages'

export interface WorkflowStage {
  key: string
  name: string
  color: string
  order: number
  terminal: boolean
  behavior: string
  modal: string
  slaHours?: number | null
}

const DEFAULT_COLORS: Record<string, string> = {
  'New Lead': '#3C82D9',
  Contacted: '#6366F1',
  Qualified: '#0F4C81',
  'Quote Sent': '#D97706',
  'Order Confirmed': '#059669',
  'Order Closed': '#0F766E',
  'Deal Lost': '#DC2626',
  Disqualified: '#94A3B8',
  [LEGACY_CLOSED_WON]: '#059669',
}

const DEFAULT_TERMINAL = new Set(['Order Closed', 'Deal Lost', 'Disqualified', LEGACY_CLOSED_WON])

const DEFAULT_SLA: Record<string, number | null> = {
  'New Lead': 1,
  Contacted: 24,
  Qualified: 3,
  'Quote Sent': 144,
  'Order Confirmed': 72,
  'Order Closed': null,
  'Deal Lost': null,
  Disqualified: null,
}

function migrateStageName(name: string): string {
  return name === LEGACY_CLOSED_WON ? 'Order Confirmed' : name
}

export function defaultWorkflowStages(): WorkflowStage[] {
  return LEAD_STAGES.map((name, i) => ({
    key: name.toLowerCase().replace(/\s+/g, '_'),
    name,
    color: DEFAULT_COLORS[name] ?? '#3C82D9',
    order: i + 1,
    terminal: DEFAULT_TERMINAL.has(name),
    behavior:
      name === 'Quote Sent'
        ? 'Quotation'
        : name === 'Order Confirmed'
          ? 'Order Execution'
          : 'Default',
    modal: 'Default',
    slaHours: DEFAULT_SLA[name] ?? 24,
  }))
}

export function normalizeWorkflowStages(raw: unknown): WorkflowStage[] {
  if (!raw || typeof raw !== 'object') return defaultWorkflowStages()
  const stages = (raw as { stages?: unknown }).stages
  if (!Array.isArray(stages) || stages.length === 0) return defaultWorkflowStages()

  // Legacy: string[]
  if (typeof stages[0] === 'string') {
    const names = (stages as string[]).map(migrateStageName)
    // Ensure new stages exist if org still has old Closed Won-only list
    const set = new Set(names)
    if (set.has('Order Confirmed') && !set.has('Order Closed')) {
      const idx = names.indexOf('Order Confirmed')
      names.splice(idx + 1, 0, 'Order Closed')
    }
    return names.map((name, i) => ({
      key: name.toLowerCase().replace(/\s+/g, '_'),
      name,
      color: DEFAULT_COLORS[name] ?? '#3C82D9',
      order: i + 1,
      terminal: DEFAULT_TERMINAL.has(name),
      behavior:
        name === 'Quote Sent'
          ? 'Quotation'
          : name === 'Order Confirmed'
            ? 'Order Execution'
            : 'Default',
      modal: 'Default',
      slaHours: DEFAULT_SLA[name] ?? 24,
    }))
  }

  const mapped = (stages as WorkflowStage[])
    .map((s, i) => {
      const name = migrateStageName(s.name)
      return {
        key: s.key || name.toLowerCase().replace(/\s+/g, '_'),
        name,
        color: s.color || DEFAULT_COLORS[name] || '#3C82D9',
        order: s.order ?? i + 1,
        terminal: name === 'Order Confirmed' ? false : Boolean(s.terminal),
        behavior:
          s.behavior ||
          (name === 'Quote Sent'
            ? 'Quotation'
            : name === 'Order Confirmed'
              ? 'Order Execution'
              : 'Default'),
        modal: s.modal || 'Default',
        slaHours: s.slaHours ?? DEFAULT_SLA[name] ?? null,
      }
    })
    .sort((a, b) => a.order - b.order)

  const names = new Set(mapped.map((s) => s.name))
  if (!names.has('Order Confirmed')) {
    return defaultWorkflowStages()
  }
  if (!names.has('Order Closed')) {
    const after = mapped.findIndex((s) => s.name === 'Order Confirmed')
    mapped.splice(after + 1, 0, {
      key: 'order_closed',
      name: 'Order Closed',
      color: DEFAULT_COLORS['Order Closed'],
      order: (mapped[after]?.order ?? 5) + 0.5,
      terminal: true,
      behavior: 'Default',
      modal: 'Default',
      slaHours: null,
    })
    return mapped
      .map((s, i) => ({ ...s, order: i + 1 }))
      .sort((a, b) => a.order - b.order)
  }

  return mapped
}

export async function getOrgWorkflowStages(orgId: string): Promise<WorkflowStage[]> {
  const settings = await prisma.settings.findUnique({
    where: { orgId },
    select: { workflowStages: true },
  })
  return normalizeWorkflowStages(settings?.workflowStages)
}

export function stageNames(stages: WorkflowStage[]): string[] {
  return stages.map((s) => s.name)
}

export function isTerminalStageName(stages: WorkflowStage[], name: string): boolean {
  return stages.find((s) => s.name === name)?.terminal ?? DEFAULT_TERMINAL.has(name)
}
