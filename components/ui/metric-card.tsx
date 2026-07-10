import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string | number
  helper?: string
  className?: string
}

/** Dense CRM insight card — label + helper + large number (veck colors). */
export function MetricCard({ label, value, helper, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card px-4 py-3.5 shadow-soft',
        className
      )}
    >
      <p className="text-sm font-medium text-foreground">{label}</p>
      {helper && <p className="mt-0.5 text-xs text-muted-foreground">{helper}</p>}
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
    </div>
  )
}
