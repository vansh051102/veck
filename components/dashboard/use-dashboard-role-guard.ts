'use client'

import { useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCurrentUser } from '@/lib/use-current-user'
import { dashboardRouteForRole } from '@/lib/dashboard-routes'

// UX-only redirect: bounces a user off a dashboard route that isn't theirs
// (e.g. a sales rep who manually navigates to /dashboards/purchase) back to
// their own. Not a security boundary — /api/v1/leads/stats always scopes
// data by the actual caller's role regardless of which page hits it.
// Admin users with ?viewAs=<userId> are exempt — they may visit any dashboard.
export function useDashboardRoleGuard() {
  const me = useCurrentUser()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isViewAs = searchParams.get('viewAs') !== null

  useEffect(() => {
    if (!me) return
    // Admin in viewAs mode is allowed on any dashboard route
    if (me.role === 'admin' && isViewAs) return
    const correctRoute = dashboardRouteForRole(me.role)
    if (correctRoute !== pathname) {
      router.replace(correctRoute)
    }
  }, [me, pathname, router, isViewAs])
}
