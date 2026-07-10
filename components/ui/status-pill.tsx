import { cn } from '@/lib/utils'

const STAGE_PILL: Record<string, string> = {
  'New Lead': 'bg-muted text-muted-foreground',
  Contacted: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  Qualified: 'bg-primary/10 text-primary',
  'Quote Sent': 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  'Order Confirmed': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'Order Closed': 'bg-teal-500/15 text-teal-800 dark:text-teal-300',
  'Closed Won': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'Deal Lost': 'bg-destructive/10 text-destructive',
  Disqualified: 'bg-muted text-muted-foreground',
}

const PRIORITY_PILL: Record<string, string> = {
  Low: 'bg-muted text-muted-foreground',
  Medium: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  High: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  Urgent: 'bg-destructive/10 text-destructive',
  Unassigned: 'bg-muted text-muted-foreground',
}

interface StatusPillProps {
  kind: 'stage' | 'priority'
  value: string
  className?: string
}

export function statusPillClass(kind: 'stage' | 'priority', value: string) {
  const map = kind === 'stage' ? STAGE_PILL : PRIORITY_PILL
  return map[value] ?? 'bg-muted text-muted-foreground'
}

export function StatusPill({ kind, value, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        statusPillClass(kind, value),
        className
      )}
    >
      {value}
    </span>
  )
}
