'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { useCurrentUser } from '@/lib/use-current-user'

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const orgId = params.orgId as string
  const me = useCurrentUser()

  return (
    <div className="flex h-screen bg-background">
      <AdminSidebar orgId={orgId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-card px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Companies
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-medium">Workspace Settings</h1>
              <p className="text-xs text-muted-foreground">Admin › Settings</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              placeholder="Search settings"
              className="crm-input h-8 w-44 text-xs"
            />
            <Link
              href="/leads"
              className="hidden text-xs text-accent hover:underline sm:inline"
            >
              Open app
            </Link>
            <ThemeToggle />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {me?.fullName?.[0]?.toUpperCase() ?? 'A'}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
