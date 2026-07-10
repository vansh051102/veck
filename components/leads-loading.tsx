'use client'

import { Skeleton } from '@/components/ui/skeleton'

function SkeletonRow({ delay }: { delay: number }) {
  return (
    <tr
      className="border-t border-border"
      style={{ animationDelay: `${delay}ms` }}
    >
      <td className="crm-table-cell w-10">
        <Skeleton className="h-4 w-4 rounded" />
      </td>
      <td className="crm-table-cell">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-36" />
        </div>
      </td>
      <td className="crm-table-cell">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
      </td>
      <td className="crm-table-cell">
        <Skeleton className="h-7 w-24 rounded-md" />
      </td>
      <td className="crm-table-cell">
        <Skeleton className="h-3.5 w-32" />
      </td>
      <td className="crm-table-cell">
        <Skeleton className="h-7 w-20 rounded-md" />
      </td>
      <td className="crm-table-cell">
        <Skeleton className="h-7 w-28 rounded-md" />
      </td>
      <td className="crm-table-cell">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
      </td>
      <td className="crm-table-cell">
        <div className="flex flex-col items-end gap-1.5">
          <Skeleton className="h-8 w-24 rounded-md" />
          <div className="flex gap-1">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>
      </td>
    </tr>
  )
}

function TableSkeleton() {
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="border-b border-border bg-card text-left text-muted-foreground">
          <tr>
            {['', 'Source & Lead', 'Contact', 'Stage', 'Stage details', 'Priority', 'Assigned to', 'Last activity', 'Actions'].map(
              (label, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-2.5 font-medium">
                  {label ? <Skeleton className="h-3 w-20" /> : <span className="sr-only">Select</span>}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }, (_, i) => (
            <SkeletonRow key={i} delay={i * 80} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MobileSkeleton() {
  return (
    <div className="flex flex-col gap-2 md:hidden">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-card p-3"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="mt-2 h-3 w-56" />
          <div className="mt-2 flex gap-2">
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-5 w-14 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

function KanbanSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {Array.from({ length: 5 }, (_, col) => (
        <div
          key={col}
          className="w-64 shrink-0 rounded-lg border border-border bg-muted/50"
          style={{ animationDelay: `${col * 100}ms` }}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-6 rounded-full" />
          </div>
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: col % 2 === 0 ? 3 : 2 }, (_, card) => (
              <div key={card} className="rounded-md border border-border bg-card p-2.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-24" />
                <Skeleton className="mt-2 h-5 w-16 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="font-medium">Loading leads</span>
      <span className="inline-flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="loading-dot h-1 w-1 rounded-full bg-primary"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
    </div>
  )
}

export function LeadsLoadingState({ view = 'list' }: { view?: 'list' | 'kanban' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="animate-fade-in flex flex-col gap-3"
    >
      <span className="sr-only">Loading leads…</span>
      <LoadingDots />
      {view === 'kanban' ? <KanbanSkeleton /> : (
        <>
          <TableSkeleton />
          <MobileSkeleton />
        </>
      )}
    </div>
  )
}
