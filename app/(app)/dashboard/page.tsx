'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/lib/use-current-user'
import { dashboardRouteForRole } from '@/lib/dashboard-routes'

// Thin redirector: /dashboard used to be a single page shared by every
// role. It's now split into per-role pages under /dashboards/*, but this
// URL is kept alive (bookmarks, ROLE_DEFAULTS fallback) as a bounce point.
export default function DashboardRedirectPage() {
  const me = useCurrentUser()
  const router = useRouter()

  useEffect(() => {
    if (me) router.replace(dashboardRouteForRole(me.role))
  }, [me, router])

  return <div className="text-sm text-muted-foreground">Loading dashboard…</div>
}
